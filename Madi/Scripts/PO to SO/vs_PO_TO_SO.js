/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
 define(['N/record', 'N/ui/serverWidget'], function (record, serverWidget) {



    function beforeLoad(context) {
        if (context.type === context.UserEventType.VIEW) {
       
         context.form.addButton({
            id: 'custpage_convert_button',
            label: 'Convert',
            functionName: 'callFunction'
        });
        context.form.clientScriptModulePath = "SuiteScripts/vs_button.js";
     }
    }

    return {
        beforeLoad: beforeLoad

    }
});

