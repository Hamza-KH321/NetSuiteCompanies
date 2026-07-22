/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/record', 'N/ui/message', 'N/currentRecord', 'N/ui/dialog'], function(record, message, currentRecord, dialog) {

    function validateLine(context) {
        var rec = context.currentRecord;
        var sublistId = context.sublistId;

        if (sublistId === 'expense') {
            var accountId = rec.getCurrentSublistValue({ sublistId: sublistId, fieldId: 'account' });

            if (accountId) {
                var accountRecord = record.load({type: 'account',id: accountId});
                var accountType = accountRecord.getValue({ fieldId: 'accttype' });

                if (accountType === 'Expense' || accountType === 'OthExpense' || accountType === 'Income' || accountType === 'COGS') {
                    var department = rec.getCurrentSublistValue({ sublistId: sublistId, fieldId: 'class' });

                    if (!department) {
                        dialog.alert({title: 'Validation',message: 'Please Enter Value For Brand.'});
                        return false;
                    }
                }
            }
        }

        return true;
    }

    return {
        validateLine: validateLine
    };
});
