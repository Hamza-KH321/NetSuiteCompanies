/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */

define(['N/record', 'N/log'], function(record, log) {
    
    function validateLine(context) {
        // This function is called when a line is being validated
        
        try {
            var currentRecord = context.currentRecord;
            var lineCount = currentRecord.getLineCount({
                sublistId: 'expense'
            });
            
            // Loop through each line and validate the data
            for (var i = 0; i <= lineCount; i++) {
                var account = currentRecord.getCurrentSublistValue({
                    sublistId: 'expense',
                    fieldId: 'account',
                    line: i
                });

                // Use the lookup field to get the account type
                var accountRecord = record.load({
                    type: record.Type.ACCOUNT,
                    id: account
                });

                var accountType = accountRecord.getValue({
                    fieldId: 'accttype'
                });
                
                log.debug('Account Type is:', accountType);
                
                // Check if the account type is Expense
                if (accountType === 'Expense') {

                    var department = currentRecord.getCurrentSublistValue({
                        sublistId: 'expense',
                        fieldId: 'department',
                        line: i
                    });
                    
                    log.debug({
                        title: 'Department is',
                        details: 'Department: ' + department
                    }); 

                    if (!department) {
                        log.debug('department is empty', department);
                        alert('Please Enter department for Expense account on line ' + (i + 1));
                        return false; // Prevent saving if validation fails
                    }
                }
            }
            
            return true; // Allow saving if all validations pass
        } catch (error) {
            log.error('ERROR:', error);
            return false; // Prevent saving if an error occurs
        }
    }
    
    return {
        validateLine: validateLine
    };
});
