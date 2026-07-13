/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Print ICTO Label
 */
define(['N/log', 'N/url', 'N/currentRecord'], function (log, url, currentRecord) {

    function pageInit(context) {
        try {
            log.debug('pageInit', 'Client script loaded');
        } catch (e) {
            log.error('pageInit error', e);
        }
    }

    function printLabel() {
        try {
            log.debug('printLabel', 'Button clicked');

            var currentRec = currentRecord.get();
            var recordId = currentRec.id;
            var recordType = currentRec.type;

            log.debug('Record Info', recordType + ' | ' + recordId);

            var suiteletUrl = url.resolveScript({
                scriptId: 'customscript_vs_sl_print_icto_label',
                deploymentId: 'customdeploy_vs_sl_print_icto_label',
                params: {
                    recordId: recordId,
                    recordType: recordType
                }
            });

            log.debug('Suitelet URL', suiteletUrl);

            window.open(suiteletUrl, '_blank');

        } catch (e) {
            log.error('printLabel error', e);
        }
    }

    return {
        pageInit: pageInit,
        printLabel: printLabel
    };
});
