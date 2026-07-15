/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || IA Lines CSV Export
 */
define(['N/currentRecord', 'N/url'], function (currentRecord, url) {

    function pageInit(context) {
        try {
            console.log('pageInit');
        } catch (e) {
            console.error(e);
        }
    }

    function downloadInventoryAdjustmentCSV() {
        try {

            var rec = currentRecord.get();

            var suiteletUrl = url.resolveScript({
                scriptId: 'customscript_sl_ia_lines_csv_export',
                deploymentId: 'customdeploy_sl_ia_lines_csv_export',
                params: {
                    iaid: rec.id
                }
            });

            window.open(suiteletUrl, '_blank');

        } catch (e) {
            console.error(e);
            alert(e.message);
        }
    }

    return {
        pageInit: pageInit,
        downloadInventoryAdjustmentCSV: downloadInventoryAdjustmentCSV
    };

});