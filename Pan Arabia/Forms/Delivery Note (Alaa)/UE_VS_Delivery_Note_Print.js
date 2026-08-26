/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Delivery Note Print
 */

define(['N/log'], function (log) {

    function beforeLoad(context) {
        try {

            log.debug('beforeLoad started', {
                eventType: context.type
            });

            if (context.type == context.UserEventType.CREATE) {
                log.debug('Button skipped', 'Create mode');
                return;
            }

            var form = context.form;

            form.clientScriptFileId = 514436;

            form.addButton({
                id: 'custpage_print_delivery_note',
                label: 'Print',
                functionName: 'printDeliveryNote'
            });

        } catch (e) {

            log.error('Error in beforeLoad', {
                name: e.name,
                message: e.message,
                stack: e.stack
            });
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});