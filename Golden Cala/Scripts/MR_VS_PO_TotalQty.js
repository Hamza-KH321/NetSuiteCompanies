/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function getInputData() {
        try {
            return search.create({
                type: "purchaseorder",
                settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
                filters:
                [
                   ["type","anyof","PurchOrd"], 
                   "AND", 
                   ["mainline","is","T"]
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
            var purchaseOrderId = result.id;

            if (!purchaseOrderId) {
                return;
            }

            var purchaseOrder = record.load({type: record.Type.PURCHASE_ORDER,id: purchaseOrderId,isDynamic: true});
            var totalQuantity = 0;
            var lineCount = purchaseOrder.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < lineCount; i++) {
                var quantity = purchaseOrder.getSublistValue({sublistId: 'item',fieldId: 'quantity',line: i}) || 0;

                totalQuantity += parseFloat(quantity);
            }

            purchaseOrder.setValue({fieldId: 'custbody_vs_total_qty',value: totalQuantity});

            purchaseOrder.save();

            log.audit({title: `Updated Purchase Order ${purchaseOrderId}`,details: `Total Quantity: ${totalQuantity}`});

        } catch (error) {
            log.error({ title: `Error in map for Purchase Order ${purchaseOrderId}`, details: error });
        }
    }

    function summarize(summary) {
        var totalProcessed = 0;
        summary.output.iterator().each(function (key, value) {
            totalProcessed++;
            return true;
        });

        log.audit({title: 'Map/Reduce Completed',details: `Total Processed Purchase Orders: ${totalProcessed}`});

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
