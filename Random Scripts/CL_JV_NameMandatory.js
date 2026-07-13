/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/search', 'N/ui/dialog'], function (search, dialog) {


    function validateLine(context) {
        try {
            var currentRecord = context.currentRecord;
            var sublistName = context.sublistId;

            if (sublistName == 'line') {
                var accountId = currentRecord.getCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'account'
                });

                var accountType = search.lookupFields({
                    type: search.Type.ACCOUNT,
                    id: accountId,
                    columns: ['type']
                }).type[0].value;

                var accountName = currentRecord.getCurrentSublistValue({ sublistId: 'line', fieldId: 'entity' });

                if ((accountType == 'AcctPay' || accountType == 'AcctRec') && !accountName) {
                    alert('The Name field is mandatory for Accounts Payable or Accounts Receivable accounts.');
                    return false; // Prevents saving the line or record
                }
            }
        } catch (error) {
            log.error ('error is ' ,error);
            return false;
        }

        return true; // Allows saving the line or record
    }

    return {
        validateLine: validateLine,

    };
});
