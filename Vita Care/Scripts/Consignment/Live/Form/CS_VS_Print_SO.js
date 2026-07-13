/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Print SO
 */
define(['N/log', 'N/currentRecord'], function (log, currentRecord) {

    function pageInit(context) {
        try {
            log.debug('pageInit', 'Client script loaded');
        } catch (e) {
            log.error('Error in pageInit', e);
        }
    }

    function printXML() {
        try {
            log.debug('printXML', 'Start');

            var rec = currentRecord.get();
            var url = rec.getValue('custpage_sl_url');

            log.debug('Suitelet URL', url);

            if (url) {
                window.open(url, '_blank');
            }

        } catch (e) {
            log.error('Error in printXML', e);
        }
    }

    return {
        pageInit: pageInit,
        printXML: printXML
    };

});