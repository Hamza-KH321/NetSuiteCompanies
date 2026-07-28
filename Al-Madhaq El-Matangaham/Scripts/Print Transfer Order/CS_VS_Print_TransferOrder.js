/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/url', 'N/log'],
    (currentRecord, url, log) => {

        function pageInit(context) {
            log.debug('Client script initialized for Transfer Order');
        }

        function onPrintTransferOrderClick() {
            try {
                const rec = currentRecord.get();
                const recordId = rec.id;

                if (!recordId) {
                    alert('No Transfer Order ID found.');
                    return;
                }

                const suiteletUrl = url.resolveScript({
                    scriptId: 'customscript_vs_sl_print_transfer_order',
                    deploymentId: 'customdeploy_vs_sl_print_transfer_order',
                    params: { recordId: recordId }
                });

                window.open(suiteletUrl, '_blank');
            } catch (e) {
                log.error('Error printing Transfer Order', e);
                alert('Error printing Transfer Order: ' + e.message);
            }
        }

        return {
            pageInit,
            onPrintTransferOrderClick
        };
    });
