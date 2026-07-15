/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || IA Lines CSV Export
 */
define([], function () {

    function beforeLoad(context) {
        try {
            if (context.type != context.UserEventType.VIEW) {
                return;
            }

            context.form.clientScriptModulePath = './CS_VS_IA_Lines_CSV_Export.js';

            context.form.addButton({
                id: 'custpage_export_csv_btn',
                label: 'Export CSV',
                functionName: 'downloadInventoryAdjustmentCSV'
            });

        } catch (e) {
            log.error('beforeLoad Error', e);
        }
    }

    return {
        beforeLoad: beforeLoad
    };

});