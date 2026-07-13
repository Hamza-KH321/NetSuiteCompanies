/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/ui/serverWidget', 'N/runtime'], function(serverWidget, runtime) {

    function beforeLoad(context) {
        if (context.type !== context.UserEventType.VIEW) return;

        var form = context.form;
        var salesOrder = context.newRecord;
        var salesOrderId = salesOrder.id;

        var existingDocumentId = salesOrder.getValue({ fieldId: 'custbody_vs_so_to_delivery_note_attach' });

        if (!existingDocumentId) {
            form.clientScriptModulePath = 'SuiteScripts/CS_VS_DeliveryDocs_Creation_SO.js';

            form.addButton({
                id: 'custpage_create_documents',
                label: 'Create Documents',
                functionName: 'createDocuments(' + salesOrderId + ')'
            });
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
