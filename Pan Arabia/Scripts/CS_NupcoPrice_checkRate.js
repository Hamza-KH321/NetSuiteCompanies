/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/ui/dialog'], function(dialog) {
try {
        function validateItemPrice(context) {
            var currentRecord = context.currentRecord;
            var sublistId = context.sublistId;
            var line = context.getCurrentSublistValue; 
    
            if (sublistId === 'item') {
                log.debug('List is changed' , sublistId);
                var zeroRate = currentRecord.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate'
                });
    
                log.debug('is Zero?' , zeroRate);
    
                if (zeroRate != 0) {
                    log.debug('Rate is not Zero' , zeroRate);
                    var rate = currentRecord.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate'
                    });
                    log.debug('rate is:' , rate);
    
                    var nupcoPrice = currentRecord.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_vs_nupcoprice'
                    });
                    log.debug('nupcoPrice is:' , nupcoPrice);
    
                    if (rate < nupcoPrice) {
                        log.debug('Rate is less than nupco price:' , true);
                        var nupcoPriceFormatted = nupcoPrice ? parseFloat(nupcoPrice).toFixed(2) : 'N/A';
                        var message = 'You have to enter an item price greater than the NUPCO PRICE. The NUPCO PRICE is ' + nupcoPriceFormatted + '.';
                        dialog.alert({
                            title: 'Price Validation',
                            message: message
                        });
                        return false;
                    }
                }
            }
            return true;
        }
} catch (error) {
    log.error('ERRORRRRR!!!' , error);
}

    function validateLine(context) {
        return validateItemPrice(context);
    }

    return {
        validateLine: validateLine
    };
});
