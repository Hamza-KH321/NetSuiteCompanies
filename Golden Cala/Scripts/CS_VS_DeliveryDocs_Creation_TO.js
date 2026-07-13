/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/record', 'N/ui/message', 'N/ui/dialog'], function(record, message, dialog) {

    function pageInit(){
        
    }

    function createDocuments(transferOrderId) {
        try {
            var msg = message.create({
                title: "Processing",
                message: "Creating document, please wait...",
                type: message.Type.INFORMATION
            });
            msg.show();

            var customRec = record.create({
                type: 'customrecord_vs_so_to_delivery_details',
                isDynamic: true
            });
            customRec.setValue({ fieldId: 'custrecord_vs_so_to', value: transferOrderId });

            var newRecId = customRec.save();
            console.log("Custom Record Created: " + newRecId);

            var transferOrder = record.load({
                type: record.Type.TRANSFER_ORDER,
                id: transferOrderId,
                isDynamic: true
            });

            transferOrder.setValue({ fieldId: 'custbody_vs_so_to_delivery_note_attach', value: newRecId });
            transferOrder.setValue({ fieldId: 'custbody_vs_markshipped', value: true });

            transferOrder.save();
            console.log("Transfer Order Updated Successfully");

            dialog.alert({
                title: "Success",
                message: "Document created successfully!"
            }).then(function () {
                location.reload();
            });

        } catch (error) {
            console.error("Error Creating Document: " + error);

            // Show error message
            dialog.alert({
                title: "Error",
                message: "Failed to create document: " + error.message
            });
        }
    }

    return {
        pageInit:pageInit,
        createDocuments: createDocuments
    };
});
