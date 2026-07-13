/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function getInputData() {
        try {
            return search.create({
                type: "transferorder",
                settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
                filters:
                [
                   ["type","anyof","TrnfrOrd"], 
                   "AND", 
                   ["mainline","is","T"], 
                   "AND", 
                   ["status","noneof","TrnfrOrd:H"]
                ],
                columns:
                [
                   search.createColumn({name: "internalid", label: "Internal ID"}),
                   search.createColumn({name: "tranid", label: "Document Number"}),
                   search.createColumn({name: "custbody_vs_total_qty", label: "Total Qty"})
                ]
            });

        } catch (error) {
            log.error({ title: 'Error in getInputData', details: error });
        }
    }

    function map(context) {
        try {
            var result = JSON.parse(context.value);
            var transferOrderId = result.id;

            if (!transferOrderId) {
                return;
            }

            var transferOrder = record.load({type: record.Type.TRANSFER_ORDER,id: transferOrderId,isDynamic: true});
            var totalQuantity = 0;
            var lineCount = transferOrder.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < lineCount; i++) {
                var quantity = transferOrder.getSublistValue({sublistId: 'item',fieldId: 'quantity',line: i}) || 0;

                totalQuantity += parseFloat(quantity);
            }

            transferOrder.setValue({fieldId: 'custbody_vs_total_qty',value: totalQuantity});

            transferOrder.save();

            log.audit({title: `Updated transfer Order ${transferOrderId}`,details: `Total Quantity: ${totalQuantity}`});

        } catch (error) {
            log.error({ title: `Error in map for transfer Order ${transferOrderId}`, details: error });
        }
    }

    function summarize(summary) {
        var totalProcessed = 0;
        summary.output.iterator().each(function (key, value) {
            totalProcessed++;
            return true;
        });

        log.audit({title: 'Map/Reduce Completed',details: `Total transfer Purchase Orders: ${totalProcessed}`});

        if (summary.inputSummary.error) {
            log.error({ title: 'Input Error', details: summary.inputSummary.error });
        }

        summary.mapSummary.errors.iterator().each(function (key, error) {
            log.error({ title: `Map Error for ${key}`, details: error });
            return true;
        });

        summary.reduceSummary.errors.iterator().each(function (key, error) {
            log.error({ title: `Reduce Error for ${key}`, details: error });
            return true;
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };

});
