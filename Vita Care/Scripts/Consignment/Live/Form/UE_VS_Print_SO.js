/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Print SO
 */
define(['N/log', 'N/url'], function (log, url) {

    function beforeLoad(context) {
        try {
            log.debug('beforeLoad', 'Start');

            if (context.type == context.UserEventType.VIEW) {

                var form = context.form;
                var rec = context.newRecord;

                var suiteletUrl = url.resolveScript({
                    scriptId: 'customscript_vs_sl_print_so',
                    deploymentId: 'customdeploy_vs_sl_print_so',
                    params: {
                        soId: rec.id
                    }
                });

                log.debug('Suitelet URL', suiteletUrl);

                form.clientScriptModulePath = './CS_VS_Print_SO.js';

                form.addButton({
                    id: 'custpage_print_xml',
                    label: 'Print SO Form',
                    functionName: 'printXML'
                });

                form.addField({
                    id: 'custpage_sl_url',
                    type: 'text',
                    label: 'Suitelet URL'
                }).updateDisplayType({
                    displayType: 'hidden'
                }).defaultValue = suiteletUrl;
            }

        } catch (e) {
            log.error('Error in beforeLoad', e);
        }
    }

    return {
        beforeLoad: beforeLoad
    };

});