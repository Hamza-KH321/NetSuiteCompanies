/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Print ICTO Label
 */
define(['N/log'], function (log) {

    function beforeLoad(context) {
        try {
            log.debug('beforeLoad', 'Context type: ' + context.type);

            if (context.type !== context.UserEventType.VIEW) {
                return;
            }

            var form = context.form;

            form.addButton({
                id: 'custpage_print_label',
                label: 'Dispatch Form',
                functionName: 'printLabel'
            });

            form.clientScriptModulePath = './CS_VS_Print_ICTO_Label.js';

        } catch (e) {
            log.error('beforeLoad error', e);
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
