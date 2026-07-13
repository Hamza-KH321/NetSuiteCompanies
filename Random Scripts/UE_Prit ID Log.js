/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function(record, log) {

    function afterSubmit(context) {
        try {
            // Check if the record type is Sales Order or Cash Sale
                
                // Get the value of the customer field
                // var customerId = context.newRecord.getValue({
                //     fieldId: 'entity' // 'entity' is the fieldId for the customer field
                // });

                var inventoryAdjustmentID = context.newRecord.getValue({
                    fieldId: 'tranid'
                });

                // Log the value of the customer field
                // log.debug({
                //     title: 'Customer Field Value',
                //     details: 'Customer ID: ' + customerId
                // });
                log.debug({
                    title: 'inventoryAdjustmentID',
                    details: 'inventoryAdjustmentID is: ' + inventoryAdjustmentID
                });

                // var lineCount = context.newRecord.getLineCount({
                //     sublistId: 'item'
                // });

                //Loop through each line item
                for (var i = 0; i < lineCount; i++) {
                    // Get the item ID and rate for each line item
                    var itemId = context.newRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i
                    });

                    var inventoryDetails = context.newRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'inventorydetail',
                        line: i
                    });

                    // Log the item and item rate for each line item
                    log.debug({
                        title: 'Line Item Details',
                        details: 'inventoryDetails: ' + inventoryDetails + ', Item: ' + item
                    });
                }
        } catch (e) {
            log.error({
                title: 'Error in SuiteScript',
                details: e.toString()
            });
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});
