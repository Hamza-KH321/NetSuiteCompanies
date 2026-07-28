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
        function getAccountType(accountId) {
            var accountRecord = record.load({
                type: record.Type.ACCOUNT,
                id: accountId
            });
    
            var accountType = accountRecord.getValue({
                fieldId: 'accttype'
            });
    
            log.debug('Account Type is: ' , accountType);
    
            return accountType;
        }
	
        var scriptObj = runtime.getCurrentScript();
        var rectype = scriptObj.getParameter({name: 'custscript_vs_recordtype'});
        var recid = scriptObj.getParameter({name: 'custscript_vs_recordid'});
        var newRecord = record.load({type:rectype , id:recid});
        
        var totalDebit = 0;
        var lineCount = newRecord.getLineCount({ sublistId: 'line' });
        // log.debug('Total Lines is:' , lineCount);

        for (var i = 0; i < lineCount; i++) {
            var debitAmount = newRecord.getSublistValue({
                sublistId: 'line',
                fieldId: 'debit',
                line: i
            });
            var accountId = newRecord.getSublistValue({
                sublistId: 'line',
                fieldId: 'account',
                line: i
            });    

            log.debug('Debit Amount' + 'Line' + i, debitAmount);

            if (debitAmount) {
                totalDebit += parseFloat(debitAmount);
            }

            var accountType = getAccountType(accountId);
            log.debug('Account ID is: ' , accountId);

            var isManager = newRecord.getValue({fieldId: "custbody_vs_managerapproval"});
            log.debug('isManager: ' , isManager);

            if (accountType == 'LongTermLiab' || accountType == 'Equity' || accountType == 'OthAsset')
            {
                newRecord.setValue({
                    fieldId: 'custbody_vs_managerapproval',
                    value: true,
                    ignoreFieldChange: true
                });
            }
        }
        log.debug('total Debit is:' , totalDebit);    
        
        newRecord.setValue({
                fieldId: 'custbody_total_debit',
                value: totalDebit,
                ignoreFieldChange: true
            });

        var recordId = newRecord.save();
        log.debug('Record Updated', 'Record ID: ' + recordId);

        } catch (error) {
            log.error("Error Updating Total Debit", error.message);
        }

    }

    return {
        execute: execute
    };
    
});
