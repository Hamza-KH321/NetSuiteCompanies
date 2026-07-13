/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/ui/serverWidget', 'N/runtime'], function(serverWidget, runtime) {

    function beforeLoad(context) {
        if (context.type !== context.UserEventType.VIEW) return;

        var form = context.form;
        var transferOrder = context.newRecord;
        var transferOrderId = transferOrder.id;

        var existingDocumentId = transferOrder.getValue({ fieldId: 'custbody_vs_so_to_delivery_note_attach' });

        if (!existingDocumentId) {
            form.clientScriptModulePath = 'SuiteScripts/CS_VS_DeliveryDocs_Creation_TO.js';

            form.addButton({
                id: 'custpage_create_documents',
                label: 'Create Documents',
                functionName: 'createDocuments(' + transferOrderId + ')'
            });
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
