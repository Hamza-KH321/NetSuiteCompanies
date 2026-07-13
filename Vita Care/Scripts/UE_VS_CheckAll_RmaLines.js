/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/ui/serverWidget'], function (serverWidget) {
    function beforeLoad(context) {
        if (context.type === context.UserEventType.EDIT || context.type === context.UserEventType.CREATE ) {
            var form = context.form;
            
            // Add the "Check All" button
            form.clientScriptModulePath = 'SuiteScripts/CL_VS_CheckAll_RmaLines.js'; // Make sure to deploy your client script and provide the correct path
            form.addButton({
                id: 'custpage_check_all_button',
                label: 'Check All',
                functionName: 'checkAllItems'
            });
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
