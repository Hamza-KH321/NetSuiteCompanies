/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {

        return search.create({
            type: "customrecord_vs_pixel_integration_errors",
            filters: [],
            columns: [
                search.createColumn({ name: "internalid" })
            ]
        });
    }

    function map(context) {
        try {
            var searchResult = JSON.parse(context.value);
            var recId = searchResult.id;

            record.delete({ type: 'customrecord_vs_pixel_integration_errors', id: recId });

            log.debug({ title: 'Record Deleted', details: 'Deleted record ID: ' + recId });

        } catch (e) {
            log.error({ title: 'Delete Failed', details: e });
        }
    }

    function summarize(summary) {

        log.audit({ title: 'Pixel Integration Errors Cleanup Completed', details: 'Total usage: ' + summary.usage });

        summary.mapSummary.errors.iterator().each(function (key, error) {
            log.error({ title: 'Map Error for key: ' + key, details: error });
            return true;
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };

});
