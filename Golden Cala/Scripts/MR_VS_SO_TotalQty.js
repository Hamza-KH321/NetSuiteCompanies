/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function getInputData() {
        try {
            return search.create({
                type: "salesorder",
                settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "SalesOrd"],
                    "AND",
                    ["mainline", "is", "T"]
                ],
                columns: [
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "tranid", label: "Document Number" }),
                    search.createColumn({ name: "custbody_vs_total_qty", label: "Total Qty" })
                ]
            });

        } catch (error) {
            log.error({ title: 'Error in getInputData', details: error });
        }
    }

    function map(context) {
        try {
            var result = JSON.parse(context.value);
            var salesOrderId = result.id;

            if (!salesOrderId) {
                return;
            }

            var salesOrder = record.load({type: record.Type.SALES_ORDER,id: salesOrderId,isDynamic: true});
            var totalQuantity = 0;
            var lineCount = salesOrder.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < lineCount; i++) {
                var quantity = salesOrder.getSublistValue({sublistId: 'item',fieldId: 'quantity',line: i}) || 0;

                totalQuantity += parseFloat(quantity);
            }

            salesOrder.setValue({fieldId: 'custbody_vs_total_qty',value: totalQuantity});

            salesOrder.save();

            log.audit({title: `Updated Sales Order ${salesOrderId}`,details: `Total Quantity: ${totalQuantity}`});

        } catch (error) {
            log.error({ title: `Error in map for Sales Order ${salesOrderId}`, details: error });
        }
    }

    function summarize(summary) {
        var totalProcessed = 0;
        summary.output.iterator().each(function (key, value) {
            totalProcessed++;
            return true;
        });

        log.audit({title: 'Map/Reduce Completed',details: `Total Processed Sales Orders: ${totalProcessed}`});

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
