/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */

define(['N/currentRecord', 'N/log'],

function(currentRecord, log) {
    
try {
        function calculateAmountAndSet(context) {
            log.debug('Calculating Amount Started');
            var currentRecord = context.currentRecord;
            var sublistId = 'expense';
            var lineCount = currentRecord.getLineCount({ sublistId: sublistId });
            
            for (var i = 0; i <= lineCount; i++) {
                var quantity = currentRecord.getCurrentSublistValue({
                    sublistId: sublistId,
                    fieldId: 'custcol_vs_quantity'
                });
                var rate = currentRecord.getCurrentSublistValue({
                    sublistId: sublistId,
                    fieldId: 'custcol_vs_unitprice'
                });
                log.debug('Quantity is: ' , quantity);
                log.debug('rate is: ' , rate);
                
                // Calculate the amount
                var amount = quantity * rate;

                log.debug('Amount is: ',amount);
                
                // Set the calculated amount on the line
                currentRecord.setCurrentSublistValue({
                    sublistId: sublistId,
                    fieldId: 'amount',
                    value: amount
                });
            }
        }
} catch (error) {
    log.error('ERORRRRRR' , error);
}
    
    function fieldChanged(context) {
        
try {
            var fieldId = context.fieldId;
            if (fieldId === 'custcol_vs_quantity' || fieldId === 'custcol_vs_unitprice') {
                log.debug('Amount or Rate have been changed');
                calculateAmountAndSet(context);
            }
} catch (error) {
    log.error('ERRORRRRRR' , error);
    
}
    }
    
    return {
        fieldChanged: fieldChanged
    };
});
