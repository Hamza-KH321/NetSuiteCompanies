/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR_VS_RMA_Approval_Submission.js
 */
define(['N/search', 'N/workflow', 'N/log'], function (search, workflow, log) {

    function getInputData() {

        try {

            log.debug({
                title: 'getInputData',
                details: 'Loading RMA Search'
            });

            return search.create({
                type: 'transaction',
                settings: [
                    {
                        name: 'consolidationtype',
                        value: 'ACCTTYPE'
                    }
                ],
                filters: [
                    ['type', 'anyof', 'RtnAuth'],
                    'AND',
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['workflow.currentstate', 'anyof', '424', '426'],
                    'AND',
                    ['customermain.internalid', 'anyof', '67010'],
                    'AND',
                    ['status', 'anyof', 'RtnAuth:A']
                ],
                columns: [
                    search.createColumn({ name: 'tranid', label: 'Document Number' }),
                    search.createColumn({ name: 'statusref', label: 'Status' }),
                    search.createColumn({ name: 'custbody8', label: 'RMA Type' }),
                    search.createColumn({ name: 'currentstate', join: 'workflow', label: 'Current State' })
                ]
            });

        } catch (e) {

            log.error({
                title: 'getInputData Error',
                details: e
            });

            throw e;
        }
    }

    function map(context) {

        try {

            var result = JSON.parse(context.value);

            var rmaId = result.id;
            var tranId = result.values.tranid;
            var rmaType = result.values.custbody8;
            var currentState = result.values['currentstate.workflow'];

            log.debug({
                title: 'Result Values',
                details: result.values
            });

            log.debug({
                title: 'Processing RMA',
                details: {
                    rmaId: rmaId,
                    tranId: tranId,
                    rmaType: rmaType
                }
            });

            if (!rmaType) {

                log.error({
                    title: 'Missing RMA Type',
                    details: rmaId
                });

                return;
            }

            if (!currentState) {

                log.error({
                    title: 'Missing Workflow State',
                    details: rmaId
                });

                return;
            }

            var workflowId = '';
            var stateId = '';
            var actionId = '';

            if (rmaType.text == 'Market Return') {

                workflowId = 'customworkflow_vs_rma_approval';

                if (currentState.value == '424') {

                    stateId = 'workflowstate252';
                    actionId = 'workflowaction1306';

                } else if (currentState.value == '426') {

                    stateId = 'workflowstate254';
                    actionId = 'workflowaction1309';

                } else {

                    log.error({
                        title: 'Unknown Return State',
                        details: {
                            rmaId: rmaId,
                            currentState: currentState
                        }
                    });

                    return;
                }

            } else if (
                rmaType.text == 'Refusal (Upon Delivery)' ||
                rmaType.text == 'Refusal (After Delivery)'
            ) {

                workflowId = 'customworkflow_vs_rma_approval_refusal';
                stateId = 'workflowstate266';
                actionId = 'workflowaction1441';

            } else {

                log.error({
                    title: 'Unknown RMA Type',
                    details: {
                        rmaId: rmaId,
                        rmaType: rmaType
                    }
                });

                return;
            }

            log.debug({
                title: 'Trigger Workflow',
                details: {
                    rmaId: rmaId,
                    workflowId: workflowId,
                    stateId: stateId,
                    actionId: actionId
                }
            });

            workflow.trigger({
                recordType: 'returnauthorization',
                recordId: rmaId,
                workflowId: workflowId,
                stateId: stateId,
                actionId: actionId
            });

            log.audit({
                title: 'Workflow Submitted',
                details: {
                    rmaId: rmaId,
                    workflowId: workflowId,
                    stateId: stateId,
                    actionId: actionId
                }
            });

        } catch (e) {

            log.error({
                title: 'Map Error',
                details: JSON.stringify({
                    name: e.name,
                    message: e.message,
                    stack: e.stack,
                    contextValue: context.value
                })
            });
        }
    }

    return {
        getInputData: getInputData,
        map: map
    };

});