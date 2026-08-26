/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Delivery Note Print
 */

define(['N/currentRecord', 'N/url', 'N/log'], function (currentRecord, url, log) {

    function pageInit(context) {
        try {

            log.debug('Client Script loaded');

        } catch (e) {

            log.error('Error in pageInit', {
                name: e.name,
                message: e.message,
                stack: e.stack
            });
        }
    }

    function printDeliveryNote() {
        try {

            var record = currentRecord.get();

            var recordId = record.id;

            log.debug('Print button clicked', {
                recordId: recordId
            });

            if (!recordId) {
                log.error('Missing record ID', 'Unable to print Delivery Note');
                return;
            }

            var suiteletUrl = url.resolveScript({
                scriptId: 'customscript_vs_del_note',
                deploymentId: 'customdeploy_vs_del_note',
                params: {
                    tranid: recordId
                }
            });

            log.debug('Delivery Note Suitelet URL', suiteletUrl);

            window.open(suiteletUrl, '_blank');

        } catch (e) {

            log.error('Error in printDeliveryNote', {
                name: e.name,
                message: e.message,
                stack: e.stack
            });
        }
    }

    return {
        pageInit: pageInit,
        printDeliveryNote: printDeliveryNote
    };
});