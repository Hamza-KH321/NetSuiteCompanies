/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/url', 'N/log'], function (currentRecord, url, log) {

    function pageInit(context) {
        try {
            log.debug('ClientScript pageInit', { type: context.mode });
        } catch (e) {
            log.error('pageInit error', e);
        }
    }

    function createIRFromICSO() {
        try {
            var rec = currentRecord.get();
            var poId = rec.id;

            if (!poId) {
                alert('PO internal ID not found.');
                return;
            }

            var slUrl = url.resolveScript({
                scriptId: 'customscript_vs_sl_create_ir_icpo',
                deploymentId: 'customdeploy_sl_create_ir_icpo',
                params: { poId: poId }
            });

            window.open(slUrl, '_blank'); // open in new tab
        } catch (e) {
            log.error('createIRFromICSO error', e);
            alert('Failed to start Item Receipt creation. See logs.');
        }
    }

    return {
        pageInit: pageInit,
        createIRFromICSO: createIRFromICSO
    };
});
