/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Print Normal SO
 */
define(['N/url'], function (url) {

    function beforeLoad(context) {

        if (context.type != context.UserEventType.VIEW) {
            return;
        }

        var suiteletUrl = url.resolveScript({
            scriptId: 'customscript_vs_sl_print_normal_so',
            deploymentId: 'customdeploy_vs_sl_print_normal_so',
            params: { soId: context.newRecord.id }
        });

        context.form.addButton({
            id: 'custpage_print_normal_so',
            label: 'Print Normal SO',
            functionName: "window.open('" + suiteletUrl + "')"
        });
    }

    return {
        beforeLoad: beforeLoad
    };

});