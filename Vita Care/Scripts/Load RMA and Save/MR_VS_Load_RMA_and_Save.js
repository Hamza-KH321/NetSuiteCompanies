/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Load RMA and Save
 */

define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {
        try {
            log.audit({
                title: 'getInputData',
                details: 'Starting Return Authorization search'
            });

            var returnauthorizationSearchObj = search.create({
                type: 'returnauthorization',
                settings: [
                    {
                        name: 'consolidationtype',
                        value: 'ACCTTYPE'
                    }
                ],
                filters: [
                    ['type', 'anyof', 'RtnAuth'],
                    'AND',
                    ['status', 'anyof', 'RtnAuth:A'],
                    'AND',
                    ['workflow.currentstate', 'anyof', '429', '451', '880'],
                    'AND',
                    ['mainline', 'is', 'T'],
                    // 'AND',
                    // ['internalid', 'is', '6539786'],
                ],
                columns: [
                    search.createColumn({
                        name: 'tranid',
                        label: 'Document Number'
                    }),
                    search.createColumn({
                        name: 'trandate',
                        label: 'Date'
                    }),
                    search.createColumn({
                        name: 'statusref',
                        label: 'Status'
                    })
                ]
            });

            return returnauthorizationSearchObj;

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
            log.debug({
                title: 'Map Context',
                details: context.value
            });

            var searchResult = JSON.parse(context.value);
            var rmaId = searchResult.id;

            log.audit({
                title: 'Processing RMA',
                details: 'RMA Internal ID: ' + rmaId
            });

            var rmaRecord = record.load({
                type: record.Type.RETURN_AUTHORIZATION,
                id: rmaId,
                isDynamic: false
            });

            var lineCount = rmaRecord.getLineCount({
                sublistId: 'item'
            });

            log.debug({
                title: 'RMA Lines',
                details: 'RMA ' + rmaId + ' has ' + lineCount + ' lines'
            });

            for (var i = 0; i < lineCount; i++) {

                var rmaValue = rmaRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_vs_rma',
                    line: i
                });

                log.debug({
                    title: 'RMA Line ' + i,
                    details: 'custcol_vs_rma = ' + rmaValue
                });
            }

            var savedId = rmaRecord.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });

            log.audit({
                title: 'RMA Saved',
                details: 'RMA ' + savedId + ' loaded and saved successfully'
            });

        } catch (e) {
            log.error({
                title: 'Map Error',
                details: 'Error processing context: ' + context.value + ' | Error: ' + e
            });
        }
    }

    return {
        getInputData: getInputData,
        map: map
    };
});