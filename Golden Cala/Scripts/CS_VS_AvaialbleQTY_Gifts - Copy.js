/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/search', 'N/currentRecord', 'N/ui/message'], function(search, currentRecord, message) {

    function fieldChanged(context) {
try {
            var rec = context.currentRecord;
    
            if (context.sublistId === 'recmachcustrecord_vs_parent_new' && context.fieldId === 'custrecord_vs_item_new') {
                var selectedItem = rec.getCurrentSublistValue({
                    sublistId: 'recmachcustrecord_vs_parent_new',
                    fieldId: 'custrecord_vs_item_new'
                });
                var location = rec.getValue('custrecord_vs_location_new');
    
                // Check if location is empty or null
                if (!location) {
                    alert('Please choose a location first.');
                    return; // Exit the script
                }
    
                var inventorybalanceSearchObj = search.create({
                    type: "inventorynumber",
                    filters:
                    [
                       ["item","anyof",selectedItem], 
                       "AND", 
                       ["location","anyof",location]
                    ],
                    columns:
                    [
                        search.createColumn({
                            name: "item",
                            summary: "GROUP",
                            label: "Item"
                         }),
                         search.createColumn({
                            name: "location",
                            summary: "GROUP",
                            label: "Location"
                         }),
                         search.createColumn({
                            name: "quantityavailable",
                            summary: "SUM",
                            label: "Available"
                         })
                    ]
                 });
    
                // Execute the search and get the first result
                inventorybalanceSearchObj.run().each(function(result) {
                    var quantityAvailable = result.getValue({name: "quantityavailable",summary: "SUM"});

                    log.debug('Item', selectedItem);
                    log.debug('quantity Available', quantityAvailable);
    
                    // Update the sublist field with the quantity on hand
                    rec.setCurrentSublistValue({sublistId: 'recmachcustrecord_vs_parent_new',fieldId: 'custrecord_vs_availableqty',value: quantityAvailable});
    
                    // Commit the sublist field change
                    //rec.commitLine({ sublistId: 'recmachcustrecord_vs_parent_new' });
    
                    return false;
                });
            }
} catch (error) {
    log.error('ERROR fieldChanged !!' , error);
}
    }

    function validateLine(context) {
try {
            var rec = context.currentRecord;
            var sublistId = 'recmachcustrecord_vs_parent_new';
            var quantityAvailable = rec.getCurrentSublistValue({sublistId: sublistId,fieldId: 'custrecord_vs_availableqty'});
            var requestedQty = rec.getCurrentSublistValue({sublistId: sublistId,fieldId: 'custrecord_vs_quantity_new'});
    
            log.debug('requestedQty' , requestedQty);
    
            if (parseFloat(requestedQty) > parseFloat(quantityAvailable)) {
                log.debug('Check' , requestedQty > quantityAvailable);
                var errorMsg = 'Requested quantity cannot exceed available quantity (' + quantityAvailable + ')';
                showMessage(errorMsg);
                return false; // Prevent line from being saved
            }
    
            return true; // Allow line to be saved
} catch (error) {
    log.error('ERROR Validate Line !!' , error);
}
    }

    function showMessage(msg) {
        var myMsg = message.create({
            title: 'Validation Error',
            message: msg,
            type: message.Type.ERROR
        });
        myMsg.show();
    }

    return {
        fieldChanged: fieldChanged,
        validateLine: validateLine
    };
});
