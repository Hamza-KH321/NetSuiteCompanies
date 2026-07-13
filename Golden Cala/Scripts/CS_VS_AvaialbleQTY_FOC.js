/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/search', 'N/currentRecord', 'N/ui/message'], function(search, currentRecord, message) {

    function fieldChanged(context) {
try {
            var rec = context.currentRecord;
    
            if (context.sublistId === 'recmachcustrecord_vs_parent_foc_new' && context.fieldId === 'custrecord_vs_item_foc_new') {
                var selectedItem = rec.getCurrentSublistValue({sublistId: 'recmachcustrecord_vs_parent_foc_new',fieldId: 'custrecord_vs_item_foc_new'});
                var location = rec.getValue('custrecord_vs_location_foc_new');
    
                if (!location) {
                    alert('Please choose a location first.');
                    return;
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
    
                    inventorybalanceSearchObj.run().each(function(result) {
                    var quantityAvailable = result.getValue({name: "quantityavailable",summary: "SUM"});
    
                    rec.setCurrentSublistValue({sublistId: 'recmachcustrecord_vs_parent_foc_new',fieldId: 'custrecord_vs_availableqty_foc_new',value: quantityAvailable});
    
                    return false;
                });
            }
} catch (error) {
    log.error('ERROR Field Change !!' , error);
}
    }

    function validateLine(context) {
try {
            var rec = context.currentRecord;
            var sublistId = 'recmachcustrecord_vs_parent_foc_new';
            var quantityAvailable = rec.getCurrentSublistValue({sublistId: sublistId,fieldId: 'custrecord_vs_availableqty_foc_new'});
            var requestedQty = rec.getCurrentSublistValue({sublistId: sublistId,fieldId: 'custrecord_vs_quantity_foc_new'});
    
            if (parseFloat(requestedQty) > parseFloat(quantityAvailable)) {
                var errorMsg = 'Requested quantity cannot exceed available quantity (' + quantityAvailable + ')';
                showMessage(errorMsg);
                return false;
            }
    
            return true;
} catch (error) {
    log.error('ERROR validate Line !!' , error);
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
