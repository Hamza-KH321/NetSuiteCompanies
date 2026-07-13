/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/record', 'N/search', 'N/ui/dialog', 'N/ui/message'], function(record, search, dialog, message) {
    
    function validateLine(context) {
        if (context.sublistId === 'expense') {
            try {
                var currentRecord = context.currentRecord;
                // var expenseAccountId = currentRecord.getCurrentSublistValue({
                //     sublistId: 'expense',
                //     fieldId: 'expenseaccount'
                // });
                // log.debug('expenseAccountId', expenseAccountId);
                

                //     // Use 'accttype' instead of 'type' for the lookup
                //     var accountType = search.lookupFields({
                //         type: 'account',
                //         id: expenseAccountId,
                //         columns: ['accttype']
                //     }).accttype[0].value; // Adjusted to retrieve the correct value

                //     log.debug('accountType', accountType);
                    

                        var classValue = currentRecord.getCurrentSublistValue({
                            sublistId: 'expense',
                            fieldId: 'class'
                        });
                        log.debug('classValue is :', classValue);

                        if (!classValue) {
                            var message = 'Please Enter Value For Brand.';
                            dialog.alert({title: 'Validation',message: message});
                            return false;
                        }
                    // }
                
            } catch (error) {
                log.error('ERROR!!', error);
            }
        }
        
        return true;
    }

    return {
        validateLine: validateLine
    };
});
