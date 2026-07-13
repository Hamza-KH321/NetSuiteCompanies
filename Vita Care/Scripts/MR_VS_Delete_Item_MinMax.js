/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search'], function(record, search) {

    function getInputData() {
        return search.create({
            type: 'customrecord_vs_itemminmaxquantity',
            filters: [],
            columns: ['internalid']
        });
    }

    function map(context) {
        var searchResult = JSON.parse(context.value);
        var recordId = searchResult.id; // Get the internal ID of the record

        try {
            record.delete({
                type: 'customrecord_vs_itemminmaxquantity',
                id: recordId
            });
            log.audit('Record Deleted', 'Record ID: ' + recordId);
        } catch (e) {
            log.error('Error Deleting Record', 'Record ID: ' + recordId + ', Error: ' + e.message);
        }
    }

    function summarize(summary) {
        summary.mapSummary.errors.iterator().each(function(key, error, executionNo) {
            log.error('Map Error', 'Key: ' + key + ', Error: ' + error);
            return true;
        });

        log.audit('Process Completed', 'Total Errors: ' + summary.mapSummary.errors.size());
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
});
