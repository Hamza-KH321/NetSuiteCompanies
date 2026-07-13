/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/ui/message', 'N/currentRecord','N/ui/dialog'], function(message, currentRecord, dialog) {

    function validateLine(context) {
        var rec = context.currentRecord;
        var sublistId = context.sublistId;
        
        // Check if the sublist is 'line'
        if (sublistId === 'line') {
            var accountType = rec.getCurrentSublistValue({ sublistId: sublistId, fieldId: 'accounttype' });
            
            // Check if the account type is 'Expense'
            if (accountType === 'Expense' || accountType === 'OthExpense' || accountType === 'Income' || accountType === 'COGS') {
                var location = rec.getCurrentSublistValue({ sublistId: sublistId, fieldId: 'department_display' });
                var brand = rec.getCurrentSublistValue({ sublistId: sublistId, fieldId: 'class_display' });

                // Check if both location and brand are filled
                if (!location || !brand) {
                    var message = 'Please Enter Value For Location and Brand.';
                    dialog.alert({
                        title: 'Validation',
                        message: message
                    });
                    return false; // Prevent saving if validation fails
                }
            }
        }
        
        return true; // Allow line to be saved
    }

    return {
        validateLine: validateLine
    };
});
