/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log'], function(search, record, log) {

    function getInputData() {
        // Create a search to get all records of customrecord_vs_automatic_po_items
        return search.create({
            type: 'customrecord_vs_automatic_po_items',
            filters: [],
            columns: ['internalid']
        });
    }

    function map(context) {
        try {
            // Parse the search result
            var result = JSON.parse(context.value);
            var internalId = result.id;

            // Delete the record using internalid
            record.delete({
                type: 'customrecord_vs_automatic_po_items',
                id: internalId
            });

            log.audit('Record Deleted', 'Deleted record ID: ' + internalId);
        } catch (e) {
            log.error('Error Deleting Record', e.message);
        }
    }

    function reduce(context) {
        // No reduce functionality needed for this use case
    }

    function summarize(summary) {
        log.audit('Map/Reduce Summary', {
            totalInput: summary.inputSummary,
            totalOutput: summary.outputSummary,
            totalErrors: summary.mapSummary.errors
        });
        
        if (summary.mapSummary.errors) {
            summary.mapSummary.errors.iterator().each(function(key, error) {
                log.error('Error in Map Stage', 'Key: ' + key + ', Error: ' + error);
                return true;
            });
        }
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});
