/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search','N/runtime'],
/**
 * @param {record} record
 * @param {search} search
 */
function(record, search, runtime) {
   
    /**
     * Definition of the Scheduled script trigger point.
     *
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
     * @Since 2015.2
     */
    function execute(scriptContext) {

try {
            var scriptObj = runtime.getCurrentScript();
            var rectype = scriptObj.getParameter({name: 'custscript_vs_transactiontypeif'});
            var recid = scriptObj.getParameter({name: 'custscript_vs_transactionidif'});
            // Get data from Transaction Record POS
            var newRecord = record.load({type:rectype,id:recid}); 
} catch (error) {
    log.error('ERRORRRRR!!!' , error);
    
}

        try {
            // var newRecord = context.newRecord;
            var createdFrom = newRecord.getValue({ fieldId: 'createdfrom' });
            var itemFulfillmentID = newRecord.getValue({ fieldId: 'tranid' });

            var itemfulfillmentSearchObj = search.create({
                type: search.Type.TRANSACTION,
                filters: [
                    ['createdfrom', 'is', createdFrom],
                    'AND',
                    ['mainline', 'is', true], // Only mainline transactions (bills and receipts)
                    'AND',
                    ['type', 'anyof', 'ItemShip'] // Only item receipts
                ],
                columns: [
                    search.createColumn({ name: 'trandate', sort: search.Sort.DESC }), // Sort by transaction date in descending order
                    search.createColumn({ name: 'type', label: 'Type' }),
                    search.createColumn({ name: 'tranid', label: 'Document Number' })
                ]
            });

            var searchResultCount = itemfulfillmentSearchObj.runPaged().count;
            log.debug('Item Fulfillment Counter is: ' , searchResultCount);

            if (createdFrom) {
                var salesOrder = record.load({
                    type: record.Type.SALES_ORDER,
                    id: createdFrom
                });

                var tranID = salesOrder.getValue({ fieldId: 'tranid' }); // Retrieve Entity ID of the Sales Order
                // var releaseNumber = salesOrder.getValue({ fieldId: 'custbody_vs_releasenumber' });

                var lineCount = salesOrder.getLineCount({ sublistId: 'item' }); // 'item' is the sublist ID for line items on Sales Order
                var totalSO = salesOrder.getValue({ fieldId: 'total' });
                var totalQty = 0;
                var totalFulfilledQty = 0;
                var totalAmount = 0;
                var totalFulfilledAmount = 0;

                for (var i = 0; i < lineCount; i++) {
                    var quantity = salesOrder.getSublistValue({
                        sublistId: 'item', // Sublist ID
                        fieldId: 'quantity', // Field ID of the quantity field
                        line: i // Line number
                    });

                    var quantityFulfilled = salesOrder.getSublistValue({
                        sublistId: 'item', // Sublist ID
                        fieldId: 'quantityfulfilled', // Field ID of the quantity field
                        line: i // Line number
                    });

                    var itemRate = salesOrder.getSublistValue({
                        sublistId: 'item', // Sublist ID
                        fieldId: 'rate', // Field ID of the quantity field
                        line: i // Line number
                    });

                    var qtyFulfilled = salesOrder.getSublistValue({
                        sublistId: 'item', // Sublist ID
                        fieldId: 'quantityfulfilled', // Field ID of the quantity field
                        line: i // Line number
                    });

                    totalQty = totalQty + quantity;
                    totalFulfilledQty = (totalFulfilledQty + quantityFulfilled) * 100;
                    totalAmount = totalAmount + (itemRate * quantity);
                    totalFulfilledAmount = totalFulfilledAmount + (qtyFulfilled * itemRate);
                    log.debug('line is: ' + i + 'With rate: '+itemRate);
// qty fulfilled * item rate then this amount / total amount
                    // log.debug('Quantity on line ' + (i + 1) + ': ', quantity);
                }

                var qtyPercentage = ((totalFulfilledQty/totalQty).toFixed(2)) + ' %';
                var ratePercentage = ((totalFulfilledAmount/totalSO).toFixed(2)) + ' %';

                log.debug('Quantity Percantage is: ', qtyPercentage);
                log.debug('Sales Order Transaction ID is: ', tranID);
                log.debug('Item Fulfillment Transaction ID is: ', itemFulfillmentID);
                log.debug('Total Amount is: ', totalAmount);
                log.debug('Total Fulfilled Amount: ', totalFulfilledAmount);
                log.debug('Rate Percentage is:: ', ratePercentage);

                salesOrder.setValue({
                    fieldId: 'custbody_vs_releasenumber',
                    value: tranID + '-' + searchResultCount
                });

                salesOrder.setValue({
                    fieldId: 'custbody_vs_releasesequance',
                    value: searchResultCount
                });

                salesOrder.setValue({
                    fieldId: 'custbody_vs_releasepercentageso',
                    value: ratePercentage
                });

                var salesOrderId = salesOrder.save();
                log.debug('Sales Order ' + salesOrderId + ' updated with Release Number: ' , itemFulfillmentID);

            }
} catch (error) {
log.error('ERRORRRRR!!' , error);

}
        

    }
    return {
        execute: execute
    };
    });