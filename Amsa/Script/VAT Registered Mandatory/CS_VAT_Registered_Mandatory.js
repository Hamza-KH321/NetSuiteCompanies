/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/ui/message', 'N/ui/dialog'], function(message, dialog) {
    
    function saveRecord(context) {
        var currentRecord = context.currentRecord;
        var isVatRegistered = currentRecord.getValue({ fieldId: 'custentity_vs_vat_registered' });
        
        if (isVatRegistered) {

            var defaultAddress = currentRecord.getValue({ fieldId: 'defaultaddress' });
            var taxIdNum = currentRecord.getValue({ fieldId: 'vatregnumber' });

            if (!defaultAddress || !taxIdNum) {
                dialog.alert({
                    title: 'Validation Error',
                    message: 'You must fill both the Default Address and Tax ID Number fields because this vendor is VAT Registered.'
                });
                
                return false;
            }
        }

        return true;
    }

    return {
        saveRecord: saveRecord
    };
});
