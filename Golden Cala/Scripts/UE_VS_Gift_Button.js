/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/ui/serverWidget'], function (serverWidget) {

    function beforeLoad(context) {
        var form = context.form;
        var currentRecord = context.newRecord;

        var giftApprovalStatus = currentRecord.getValue({ fieldId: 'custrecord_vs_giftapprovalstatus' });

        if (giftApprovalStatus == '2') {
            form.addButton({
                id: 'custpage_approve_button',
                label: 'Create Gift',
                functionName: 'triggerScheduledScript'
            });
            form.clientScriptModulePath = './client_script.js';
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
