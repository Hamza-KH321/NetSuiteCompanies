/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/ui/serverWidget', 'N/url'], function (serverWidget, url) {

    function beforeLoad(context) {
        if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
            return;
        }

        var form = context.form;

        // Generate Suitelet URL dynamically
        var suiteletUrl = url.resolveScript({
            scriptId: 'customscript_vs_sl_addmultiitemsscreen', // Update with your actual Suitelet script ID
            deploymentId: 'customdeploy_vs_sl_addmultiitemsscreen'
        });

        // Attach Client Script
        form.clientScriptModulePath = "SuiteScripts/elite_sales_order_client_script.js";



        // Get the item sublist
        var sublist = form.getSublist({ id: 'item' }); // 'item' is the ID for the Items sublist

        if (sublist) {
            // Add a button to the item sublist
            sublist.addButton({
                id: 'custpage_add_items_sublist',
                label: 'Add Multiple (Custom)',
                functionName: "openItemSelection('" + suiteletUrl + "')"
            });
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
