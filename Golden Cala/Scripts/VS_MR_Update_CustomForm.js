/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/log'], function(record, search, log) {

    function getInputData() {
        // Define the search object
        var salesorderSearchObj = search.create({
            type: "salesorder",
            settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
            filters:
            [
               ["mainline","is","T"], 
               "AND", 
               ["type","anyof","SalesOrd"], 
               "AND", 
               ["customform","anyof","127"], 
               "AND", 
               ["source","anyof","CSV"]
            ],
            columns:
            [
               search.createColumn({name: "customform", label: "Custom Form"}),
               search.createColumn({name: "tranid", label: "Document Number"})
            ]
         });

        return salesorderSearchObj;
    }

    function map(context) {
        var searchResult = JSON.parse(context.value);
        var internalId = searchResult.id;

        try {
            // Load the sales order record
            var salesOrderRecord = record.load({
                type: record.Type.SALES_ORDER,
                id: internalId
            });

            // Set the customform field to 125
            salesOrderRecord.setValue({
                fieldId: 'customform',
                value: 125
            });

            // Save the record
            salesOrderRecord.save();

            log.debug('Success', 'Sales Order ' + internalId + ' updated successfully.');
        } catch (e) {
            log.error('Error', 'Error updating Sales Order ' + internalId + ': ' + e.message);
        }
    }

    function reduce(context) {
        // Not used in this scenario
    }

    function summarize(summary) {
        log.audit('Summary', 'Map/Reduce script completed.');

        summary.mapSummary.errors.iterator().each(function(key, error, executionNo) {
            log.error('Map Error', 'Error on key: ' + key + ' - ' + error);
            return true;
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});
