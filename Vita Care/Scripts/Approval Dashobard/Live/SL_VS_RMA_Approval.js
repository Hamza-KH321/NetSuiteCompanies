/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || RMA Approval
 */
define(['N/log', 'N/runtime', 'N/workflow'], function (log, runtime, workflow) {

    /* =====================================================
     * WORKFLOW 373 — Workflow RMA Approval (Market Return) V2
     * Vendor-approval-style level map (must stay identical to
     * the map in SL_VS_Approval_Dashboard.js).
     * ===================================================== */
    const RMA_V2_WORKFLOW_SCRIPT_ID = 'customworkflow_vs_workflow_rma_approval'; 

    const RMA_V2_SHARED_LEVELS = {
        'AR Team Approval': {
            approve: 'workflowaction2287',
            reject:  'workflowaction2288',
            allowedUsers: [187285, 491508, 450826, 66004]
        }
    };

    const RMA_V2_PERUSER_LEVELS = {
        'Non Wasfati ASM Jeddah': {
            users: { 4334: { approve: 'workflowaction2277', reject: 'workflowaction2278' } }
        },
        'Wasfati ASM': {
            users: { 14374: { approve: 'workflowaction2259', reject: 'workflowaction2260' } }
        },
        'Non Wasfati ASM Riyadh': {
            users: {
                516377: { approve: 'workflowaction2294', reject: 'workflowaction2295' },
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
    };

    /* =====================================================
     * RESOLVE ACTION for a 373 (V2) record — mirrors
     * vendor approval's resolveAction(): no stateId is
     * passed to workflow.trigger(), same as vendor.
     * actionType is one of 'approve' | 'reject' | 'approveBD'
     * ===================================================== */
    function resolveActionV2(levelName, actionType, userId, roleId) {
        const shared = RMA_V2_SHARED_LEVELS[levelName];
        if (shared) {
            const authorized = roleId === 3 || shared.allowedUsers.indexOf(userId) !== -1;
            if (!authorized) return null;
            // shared levels only support approve/reject, never the BD-request variant
            return actionType === 'approveBD' ? null : (shared[actionType] || null);
        }

        const perUser = RMA_V2_PERUSER_LEVELS[levelName];
        if (perUser) {
            // Admin can act on ANY level, on behalf of any of the named approvers there.
            if (roleId === 3) {
                const anyEntry = Object.values(perUser.users).find(function (u) { return u[actionType]; });
                return anyEntry ? anyEntry[actionType] : null;
            }

            const userEntry = perUser.users[userId];
            if (!userEntry) return null;
            return userEntry[actionType] || null;
        }

        return null; // unknown level (e.g. 'Initial', or bad data)
    }

    function onRequest(context) {
        if (context.request.method !== 'POST') {
            context.response.write('POST only');
            return;
        }

        try {
            var requestBody = JSON.parse(context.request.body);
            var records = requestBody.records || []; // [{ recordId, currentState, workflowId }]
            var action = requestBody.action; // 'approve' | 'reject' | 'approveBD'

            var currentUser = runtime.getCurrentUser();
            var currentUserId = currentUser.id;
            var currentUserRole = currentUser.role;

            log.debug('requestBody', requestBody);

            /* =====================================================
             * WORKFLOW 238 — customworkflow_vs_rma_approval_refusal
             * WORKFLOW 237 — customworkflow_vs_rma_approval (legacy;
             * no longer surfaced by the dashboard, kept only so any
             * stray legacy call doesn't hard-crash the script)
             * UNCHANGED — do not modify this map or switch logic.
             * ===================================================== */
            var stateIdToScriptIdMap = {
                446: 'workflowstate267', 447: 'workflowstate268', 449: 'workflowstate270',
                448: 'workflowstate269', 450: 'workflowstate271', 452: 'workflowstate273',
                426: 'workflowstate254', 439: 'workflowstate260', 425: 'workflowstate253',
                444: 'workflowstate265', 427: 'workflowstate255', 440: 'workflowstate261',
                428: 'workflowstate256', 442: 'workflowstate263', 430: 'workflowstate258',
                443: 'workflowstate264'
            };

            var responseDetails = [];

            records.forEach((rec) => {
                var recordId = rec.recordId;
                var workflowId = rec.workflowId;

                /* -------- NEW: Workflow 373 (V2) -------- */
                if (workflowId === RMA_V2_WORKFLOW_SCRIPT_ID) {
                    var levelName = rec.currentState; // text value from custbody_vs_current_rma_approval_state

                    log.audit('Processing Record for Approval (V2)', {
                        recordId, workflowId, levelName, action, currentUserId, currentUserRole
                    });

                    try {
                        var actionId = resolveActionV2(levelName, action, currentUserId, currentUserRole);

                        if (!actionId) {
                            throw new Error('You are not authorized to ' + action + ' this record at its current level (' + levelName + '), or that action is not available here.');
                        }

                        var instanceId = workflow.trigger({
                            recordType: 'returnauthorization',
                            recordId: recordId,
                            workflowId: RMA_V2_WORKFLOW_SCRIPT_ID,
                            actionId: actionId
                        });

                        responseDetails.push({ recordId, status: 'success', triggered: true, instanceId });
                    } catch (err) {
                        log.error('Workflow Trigger Error (V2)', { recordId, message: err.message });
                        responseDetails.push({ recordId, status: 'error', message: err.message });
                    }

                    return; // next record
                }

                /* -------- UNCHANGED: legacy 238 / 237 logic -------- */
                var stateInternalId = rec.currentState;
                var currentState = stateIdToScriptIdMap[stateInternalId];

                log.audit('Processing Record for Approval', {
                    recordId, receivedWorkflowId: workflowId, receivedCurrentState: stateInternalId, resolvedScriptState: currentState
                });

                if (!currentState) {
                    responseDetails.push({ recordId, status: 'error', message: 'Unknown or unsupported workflow state ID: ' + stateInternalId });
                    return;
                }

                try {
                    let stateId = '';
                    let actionId = '';

                    if (workflowId === 'customworkflow_vs_rma_approval_refusal') {
                        switch (currentState) {
                            case 'workflowstate267': stateId = currentState; actionId = action === 'approve' ? 'workflowaction1449' : 'workflowaction1450'; break;
                            case 'workflowstate268': if (action === 'approve') { stateId = currentState; actionId = 'workflowaction1453'; } break;
                            case 'workflowstate270': stateId = currentState; actionId = action === 'approve' ? 'workflowaction1473' : 'workflowaction1474'; break;
                            case 'workflowstate269': stateId = currentState; actionId = action === 'approve' ? 'workflowaction1470' : 'workflowaction1471'; break;
                            case 'workflowstate271': stateId = currentState; actionId = action === 'approve' ? 'workflowaction1480' : 'workflowaction1481'; break;
                            case 'workflowstate273': stateId = currentState; actionId = action === 'approve' ? 'workflowaction1485' : 'workflowaction1486'; break;
                            default: throw new Error('Unknown state in workflow 1: ' + currentState);
                        }
                    }
                    else if (workflowId === 'customworkflow_vs_rma_approval') {
                        switch (currentState) {
                            case 'workflowstate254': stateId = currentState; actionId = action === 'approve' ? 'workflowaction1309' : 'workflowaction1360'; break;
                            case 'workflowstate260': if (action === 'approve') { stateId = currentState; actionId = 'workflowaction1371'; } break;
                            case 'workflowstate253': stateId = currentState; actionId = action === 'approve' ? 'workflowaction1307' : 'workflowaction1359'; break;
                            case 'workflowstate265': stateId = currentState; actionId = action === 'approve' ? 'workflowaction1429' : 'workflowaction1430'; break;
                            case 'workflowstate255': stateId = currentState; actionId = action === 'approve' ? 'workflowaction1317' : 'workflowaction1318'; break;
                            case 'workflowstate261': stateId = currentState; actionId = action === 'approve' ? 'workflowaction1383' : 'workflowaction1384'; break;
                            case 'workflowstate256': stateId = currentState; actionId = action === 'approve' ? 'workflowaction1324' : 'workflowaction1325'; break;
                            case 'workflowstate263': stateId = currentState; actionId = action === 'approve' ? 'workflowaction1410' : 'workflowaction1411'; break;
                            case 'workflowstate258': stateId = currentState; actionId = action === 'approve' ? 'workflowaction1332' : 'workflowaction1333'; break;
                            case 'workflowstate264': stateId = currentState; actionId = action === 'approve' ? 'workflowaction1421' : 'workflowaction1422'; break;
                            default: throw new Error('Unknown state in workflow 2: ' + currentState);
                        }
                    }

                    if (!stateId || !actionId) {
                        throw new Error(`No action for state ${currentState} and action ${action}`);
                    }

                    var instanceId2 = workflow.trigger({
                        recordType: 'returnauthorization',
                        recordId: recordId,
                        workflowId: workflowId,
                        stateId: stateId,
                        actionId: actionId
                    });

                    responseDetails.push({ recordId, status: 'success', triggered: true, instanceId: instanceId2 });

                } catch (err) {
                    log.error('Workflow Trigger Error', { recordId, message: err.message });
                    responseDetails.push({ recordId, status: 'error', message: err.message });
                }
            });

            context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
            context.response.write(JSON.stringify({ result: responseDetails }));
        } catch (error) {
            log.error('Suitelet Fatal Error', error);
            context.response.write(JSON.stringify({ error: error.message }));
        }
    }

    return { onRequest };
});