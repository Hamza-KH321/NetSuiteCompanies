/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Approval Dashboard
 */
define(['N/file', 'N/search', 'N/log', 'N/render', 'N/runtime'], function (file, search, log, render, runtime) {

    /* =====================================================
     * WORKFLOW 238 — customworkflow_vs_rma_approval_refusal
     * UNCHANGED — do not modify this map.
     * ===================================================== */
    const approvalAccessMap = {
        238: {
            446: { roles: [3], users: [379965, 55093] },             // SR Coordinator Review
            447: { roles: [], users: [] },                           // SR Coordinator Reject (Initial)
            448: { roles: [3, 1061, 1052, 1062], users: [336219, 55093] },  // Supply Chain Leader Approval
            449: { roles: [3], users: [379965, 55093] },             // Supply Chain Reject (SR Cord)
            450: { roles: [3, 1070], users: [435054] },              // Commercial Director Approval
            452: { roles: [3, 1061, 1052, 1062], users: [336219] }   // Comm Director Reject (Supply Chain)
        }
        // NOTE: workflow 237 (customworkflow_vs_rma_approval) intentionally removed —
        // replaced by workflow 373 below. In-flight 237 records are ignored per request.
    };

    /* =====================================================
     * WORKFLOW 373 — Workflow RMA Approval (Market Return) V2
     * Vendor-approval-style level map. Level names below must
     * match the exact text stored in
     * custbody_vs_current_rma_approval_state on the record.
     * ===================================================== */
    const RMA_V2_WORKFLOW_NUMERIC_ID = '373'; // used only in the search filter
    const RMA_V2_WORKFLOW_SCRIPT_ID  = 'customworkflow_vs_workflow_rma_approval'; // TODO: confirm actual script id — required by workflow.trigger()

    // Levels where a single action pair is shared by every allowed user (plus Admin)
    const RMA_V2_SHARED_LEVELS = {
        'AR Team Approval': {
            approve: 'workflowaction2287',
            reject:  'workflowaction2288',
            allowedUsers: [187285, 491508, 450826, 66004]
        }
    };

    // Levels where each named user has their OWN distinct action id.
    // Admin (role 3) can act on these too (using any valid action id for
    // that level/action type — see resolveActionV2 in SL_VS_RMA_Approval.js).
    // Anyone else not explicitly listed can VIEW these rows but not act.
    const RMA_V2_PERUSER_LEVELS = {
        'Non Wasfati ASM Jeddah': {
            users: { 4334: { approve: 'workflowaction2277', reject: 'workflowaction2278' } }
        },
        'Wasfati ASM': {
            users: { 14374: { approve: 'workflowaction2259', reject: 'workflowaction2260' } }
        },
        'Non Wasfati ASM Riyadh': {
            users: {
                509907: { approve: 'workflowaction2294', reject: 'workflowaction2295' },
                190893: { approve: 'workflowaction2296', reject: 'workflowaction2297' }
            }
        },
        'SR Coordinator Riyadh': {
            users: {
                410588: { approve: 'workflowaction2300', reject: 'workflowaction2301', approveBD: 'workflowaction2302' }
            }
        },
        'BD Approval Riyadh': {
            users: {
                425366: { approve: 'workflowaction2306', reject: 'workflowaction2307' },
                489399: { approve: 'workflowaction2308', reject: 'workflowaction2309' }
            }
        },
        'Commercial Director Approval': {
            users: { 4334: { approve: 'workflowaction2281', reject: 'workflowaction2282' } }
        },
        'SR Coordinator Jeddah': {
            users: {
                379965: { approve: 'workflowaction2263', reject: 'workflowaction2264', approveBD: 'workflowaction2265' }
            }
        },
        'BD Approval Jeddah': {
            users: {
                146766: { approve: 'workflowaction2269', reject: 'workflowaction2270' },
                425160: { approve: 'workflowaction2271', reject: 'workflowaction2272' },
                421041: { approve: 'workflowaction2273', reject: 'workflowaction2274' }
            }
        },
        'CS RMA leader Approval': {
            users: { 55093: { approve: 'workflowaction2312', reject: 'workflowaction2313' } }
        },
        'Transaction RMA Approval Jeddah': {
            users: { 432836: { approve: 'workflowaction2316', reject: 'workflowaction2317' } }
        },
        'Transaction RMA Approval Riyadh': {
            users: { 351338: { approve: 'workflowaction2320', reject: 'workflowaction2321' } }
        }
        // 'Initial' state deliberately excluded — never shown in this dashboard.
    };

    // Levels where a 3rd "Approve & Request BD Approval" action exists
    const RMA_V2_BD_REQUEST_LEVELS = ['SR Coordinator Riyadh', 'SR Coordinator Jeddah'];

    /* =====================================================
     * VISIBILITY (which rows a user is allowed to SEE)
     * Admin (role 3) sees everything. Everyone else sees only
     * rows for levels they're named on (shared or per-user).
     * ===================================================== */
    function isLevelVisibleToUser(levelName, userId, roleId) {
        if (roleId === 3) return true;

        var shared = RMA_V2_SHARED_LEVELS[levelName];
        if (shared) return shared.allowedUsers.indexOf(userId) !== -1;

        var perUser = RMA_V2_PERUSER_LEVELS[levelName];
        if (perUser) return Object.prototype.hasOwnProperty.call(perUser.users, userId);

        return false; // unknown level name (e.g. 'Initial') — never shown
    }

    function onRequest(context) {
        try {
            const userId = runtime.getCurrentUser().id;
            const roleId = runtime.getCurrentUser().role;

            if (context.request.method === 'GET') {
                var fileObj = file.load({ id: 'SuiteScripts/Approval Dashboard/Approval_Dashboard.html' });
                context.response.write(fileObj.getContents());
            }
            else if (context.request.method === 'POST') {
                var requestData = JSON.parse(context.request.body);

                if (requestData.action === 'download') {
                    var fileContent = generateTransactionFile(requestData.transaction_id);
                    context.response.addHeader({ name: 'Content-Type', value: 'application/pdf' });
                    context.response.addHeader({
                        name: 'Content-Disposition',
                        value: `attachment; filename="Transaction_${requestData.transaction_id}.pdf"`
                    });
                    context.response.write(fileContent);
                }
                else if (requestData.action === 'search') {
                    var transactions = getReturnAuthorizations(userId, roleId);
                    context.response.write(JSON.stringify(transactions));
                }
            }

        } catch (error) {
            log.error({ title: 'Error in onRequest', details: error });
        }
    }

    function getReturnAuthorizations(userId, roleId) {
        try {
            var results = [];

            var returnSearch = search.create({
                type: "returnauthorization",
                settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
                filters:
                    [
                        ["mainline", "is", "T"],
                        "AND",
                        ["type", "anyof", "RtnAuth"],
                        "AND",
                        ["status", "anyof", "RtnAuth:A"],
                        "AND",
                        ["trandate", "after", "01/03/2025"],
                        "AND",
                        [[["workflow.workflow", "anyof", "238"], "AND", ["custbody8", "anyof", "3", "1"]],
                            "OR",
                            [["workflow.workflow", "anyof", RMA_V2_WORKFLOW_NUMERIC_ID], "AND", ["custbody8", "anyof", "2"]]]
                    ],
                columns: [
                    search.createColumn({ name: "type" }),
                    search.createColumn({ name: "tranid" }),
                    search.createColumn({ name: "trandate" }),
                    search.createColumn({ name: "amount" }),
                    search.createColumn({ name: "entity" }),
                    search.createColumn({ name: "location" }),
                    search.createColumn({ name: "custbody8" }),
                    search.createColumn({ name: "currentstate", join: "workflow" }),
                    search.createColumn({ name: "workflow", join: "workflow" }),
                    search.createColumn({ name: "custbody_vs_current_rma_approval_state" })
                ]
            });

            var pagedResults = returnSearch.runPaged({ pageSize: 1000 });

            pagedResults.pageRanges.forEach(function (pageRange) {
                var page = pagedResults.fetch({ index: pageRange.index });
                page.data.forEach(function (result) {
                    const workflowId = parseInt(result.getValue({ name: 'workflow', join: 'workflow' }));

                    let include = false;
                    let currentStateForPayload = null;
                    let workflowScriptId = null;

                    if (workflowId === 238) {
                        const currentState = parseInt(result.getValue({ name: 'currentstate', join: 'workflow' }));
                        const allowed = approvalAccessMap[238] && approvalAccessMap[238][currentState];

                        if (allowed) {
                            const isRoleAllowed = allowed.roles.includes(roleId);
                            const isUserAllowed = allowed.users.includes(userId);
                            include = isRoleAllowed || isUserAllowed;
                        } else {
                            log.debug('No mapping found for state', { workflowId, currentState });
                        }

                        currentStateForPayload = currentState;
                        workflowScriptId = 'customworkflow_vs_rma_approval_refusal';

                    } else if (String(workflowId) === RMA_V2_WORKFLOW_NUMERIC_ID) {
                        const levelName = result.getValue('custbody_vs_current_rma_approval_state');

                        if (levelName && (RMA_V2_SHARED_LEVELS[levelName] || RMA_V2_PERUSER_LEVELS[levelName])) {
                            include = isLevelVisibleToUser(levelName, userId, roleId);
                        }
                        // 'Initial' or unknown/blank level names are never included

                        currentStateForPayload = levelName;
                        workflowScriptId = RMA_V2_WORKFLOW_SCRIPT_ID;
                    }

                    if (include) {
                        results.push({
                            transaction_id: result.id,
                            transaction_number: result.getValue('tranid'),
                            date: result.getValue('trandate'),
                            total: result.getValue('amount'),
                            transaction_type: result.getText('type'),
                            entity: result.getText('entity') || '',
                            location: result.getText('location') || '',
                            rma_type: result.getText('custbody8') || '',
                            current_state: currentStateForPayload,
                            workflow_id: workflowScriptId,
                            // lets the frontend enable/disable the 3rd button without guessing
                            bd_request_eligible: RMA_V2_BD_REQUEST_LEVELS.indexOf(currentStateForPayload) !== -1
                        });
                    }
                });
            });

            return { results };

        } catch (error) {
            log.error({ title: 'Error in getReturnAuthorizations', details: error });
            return { results: [], error: error.message };
        }
    }

    function generateTransactionFile(transactionId) {
        try {
            var transactionFile = render.transaction({
                entityId: parseInt(transactionId),
                printMode: render.PrintMode.PDF
            });
            return transactionFile.getContents();
        } catch (error) {
            log.error({ title: 'Error Generating Transaction File', details: error });
            return null;
        }
    }

    return { onRequest };
});