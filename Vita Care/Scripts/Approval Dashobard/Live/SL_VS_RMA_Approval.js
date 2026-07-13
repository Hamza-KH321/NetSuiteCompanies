/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log', 'N/runtime', 'N/workflow'], function (log, runtime, workflow) {
    function onRequest(context) {
        if (context.request.method !== 'POST') {
            context.response.write('POST only');
            return;
        }

        try {
            var requestBody = JSON.parse(context.request.body);
            var records = requestBody.records || []; // [{ recordId, currentState }]
            var action = requestBody.action; // 'approve' or 'reject'

            log.debug('requestBody', requestBody);

            var stateIdToScriptIdMap = {
                // Workflow 1: customworkflow_vs_rma_approval_refusal
                446: 'workflowstate267', // SR Coordinator Review
                447: 'workflowstate268', // SR Coordinator Reject (Initial)
                449: 'workflowstate270', // Supply Chain Reject (SR Cord)
                448: 'workflowstate269', // Supply Chain Leader Approval
                450: 'workflowstate271', // Commercial Director Approval
                452: 'workflowstate273', // Comm Director Reject (Supply Chain)

                // Workflow 2: customworkflow_vs_rma_approval
                426: 'workflowstate254', // SR Coordinator Review
                439: 'workflowstate260', // SR Coordinator Reject (Initial)
                425: 'workflowstate253', // AR Analyst Review
                444: 'workflowstate265', // AR Analyst Reject (SR Coordinator)
                427: 'workflowstate255', // Regional Commercial Manager Approval
                440: 'workflowstate261', // Regional Comm Reject (AR Analyst)
                428: 'workflowstate256', // Supply Chain Leader Approval
                442: 'workflowstate263', // Supply Chain Leader Reject (Regional Ma)
                430: 'workflowstate258', // Commercial Director Approval
                443: 'workflowstate264'  // Comm Director Reject (Supp leader)
            };

            var responseDetails = [];

            records.forEach((rec) => {
                var recordId = rec.recordId;
                var stateInternalId = rec.currentState;
                var workflowId = rec.workflowId;

                var currentState = stateIdToScriptIdMap[stateInternalId];

                log.audit('Processing Record for Approval', {
                    recordId,
                    receivedWorkflowId: workflowId,
                    receivedCurrentState: stateInternalId,
                    resolvedScriptState: currentState
                });


                if (!currentState) {
                    throw new Error('Unknown or unsupported workflow state ID: ' + stateInternalId);
                }

                try {
                    let stateId = '';
                    let actionId = '';

                    // Workflow 1
                    if (workflowId === 'customworkflow_vs_rma_approval_refusal') {
                        // Before triggering workflow
                        log.audit('Triggering Workflow', {
                            recordId,
                            workflowId,
                            stateId,
                            actionId
                        });
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

                    // Workflow 2
                    else if (workflowId === 'customworkflow_vs_rma_approval') {
                        // Before triggering workflow
                        log.audit('Triggering Workflow', {
                            recordId,
                            workflowId,
                            stateId,
                            actionId
                        });
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

                    var instanceId = workflow.trigger({
                        recordType: 'returnauthorization',
                        recordId: recordId,
                        workflowId: workflowId,
                        stateId: stateId,
                        actionId: actionId
                    });

                    responseDetails.push({ recordId, status: 'success', triggered: true, instanceId });

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
