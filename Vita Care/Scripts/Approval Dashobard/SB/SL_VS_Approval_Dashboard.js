/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Approval Dashboard
 */
define(['N/file', 'N/search', 'N/log', 'N/render', 'N/runtime'], function (file, search, log, render, runtime) {

    const approvalAccessMap = {
        238: { // customworkflow_vs_rma_approval_refusal
            446: { roles: [3], users: [379965, 55093] },             // SR Coordinator Review
            447: { roles: [], users: [] },                           // SR Coordinator Reject (Initial)
            448: { roles: [3, 1061, 1052, 1062], users: [336219] },  // Supply Chain Leader Approval
            449: { roles: [3], users: [379965, 55093] },             // Supply Chain Reject (SR Cord)
            450: { roles: [3, 1070], users: [435054] },              // Commercial Director Approval
            452: { roles: [3, 1061, 1052, 1062], users: [336219] }   // Comm Director Reject (Supply Chain)
        },
        237: { // customworkflow_vs_rma_approval return
            426: { roles: [3], users: [55093, 379965] },             // SR Coordinator Review
            439: { roles: [], users: [] },                           // SR Coordinator Reject (Initial)
            425: { roles: [3, 1060, 1046], users: [] },              // AR Analyst Review
            444: { roles: [3], users: [55093, 379965] },             // AR Analyst Reject (SR Coordinator)
            427: { roles: [3, 1055], users: [304193, 190893, 435054] },      // Regional Commercial Manager Approval
            440: { roles: [3, 1060, 1046], users: [] },              // Regional Comm Reject (AR Analyst)
            428: { roles: [3, 1052, 1061, 1062], users: [336219] },  // Supply Chain Leader Approval
            442: { roles: [3, 1055], users: [304193, 190893, 435054] },      // Supply Chain Leader Reject (Regional Ma)
            430: { roles: [3, 1070], users: [] },                    // Commercial Director Approval
            443: { roles: [3, 1052, 1061, 1062], users: [336219] }   // Comm Director Reject (Supp leader)
        }
    };

    function onRequest(context) {
        try {
            const userId = runtime.getCurrentUser().id;
            const roleId = runtime.getCurrentUser().role;

            // log.debug('Current User Info', { userId, roleId });

            if (context.request.method === 'GET') {
                var fileObj = file.load({ id: 'SuiteScripts/Approval Dashboard/Approval_Dashboard.html' });
                context.response.write(fileObj.getContents());
            }
            else if (context.request.method === 'POST') {
                var requestData = JSON.parse(context.request.body);

                if (requestData.action === 'download') {
                    var fileContent = generateTransactionFile(requestData.transaction_id);
                    context.response.addHeader({
                        name: 'Content-Type',
                        value: 'application/pdf'
                    });
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
                        [[["workflow.workflow", "anyof", "238"], "AND", ["custbody8", "anyof", "3", "1"]], "OR", [["workflow.workflow", "anyof", "237"], "AND", ["custbody8", "anyof", "2"]]]
                    ],
                columns: [
                    search.createColumn({ name: "type" }),
                    search.createColumn({ name: "tranid" }),
                    search.createColumn({ name: "trandate" }),
                    search.createColumn({ name: "amount" }),
                    search.createColumn({ name: "entity" }),
                    search.createColumn({ name: "currentstate", join: "workflow" }),
                    search.createColumn({ name: "workflow", join: "workflow" })
                ]
            });

            var pagedResults = returnSearch.runPaged({ pageSize: 1000 });

            pagedResults.pageRanges.forEach(function (pageRange) {
                var page = pagedResults.fetch({ index: pageRange.index });
                page.data.forEach(function (result) {
                    const workflowId = parseInt(result.getValue({ name: 'workflow', join: 'workflow' }));
                    const currentState = parseInt(result.getValue({ name: 'currentstate', join: 'workflow' }));

                    log.debug('Transaction Evaluated', {
                        recordId: result.id,
                        workflowId,
                        currentState
                    });

                    let include = true;

                    if (workflowId === 237 || workflowId === 238) {
                        include = false;
                        const allowed = approvalAccessMap[workflowId] && approvalAccessMap[workflowId][currentState];

                        if (allowed) {
                            const isRoleAllowed = allowed.roles.includes(roleId);
                            const isUserAllowed = allowed.users.includes(userId);

                            if (isRoleAllowed || isUserAllowed) {
                                include = true;
                            }
                        } else {
                            log.debug('No mapping found for state', { workflowId, currentState });
                        }
                    }

                    if (include) {
                        const workflowScriptIdMap = {
                            237: 'customworkflow_vs_rma_approval',
                            238: 'customworkflow_vs_rma_approval_refusal'
                        };
                        log.debug('Pushed Data', {
                            transaction_id: result.id,
                            transaction_number: result.getValue('tranid'),
                            date: result.getValue('trandate'),
                            total: result.getValue('amount'),
                            transaction_type: result.getText('type'),
                            entity: result.getText('entity') || '',
                            current_state: currentState,
                            workflow_id: workflowScriptIdMap[workflowId] || 'unknown'
                        })

                        results.push({
                            transaction_id: result.id,
                            transaction_number: result.getValue('tranid'),
                            date: result.getValue('trandate'),
                            total: result.getValue('amount'),
                            transaction_type: result.getText('type'),
                            entity: result.getText('entity') || '',
                            current_state: currentState,
                            workflow_id: workflowScriptIdMap[workflowId] || 'unknown'
                        });
                    }
                    else {
                        // log.debug('Transaction Skipped (No Access)', {
                        //     recordId: result.id,
                        //     workflowId,
                        //     currentState
                        // });
                    }
                });
            });

            // log.debug('Final Transactions Returned', results.length);
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
