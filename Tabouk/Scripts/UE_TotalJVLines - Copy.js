/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function(record, log) {

    function beforeSubmit(context) {
        
            try {
            var newRecord = context.newRecord;
            var totalDebit = 0;
            var lineCount = newRecord.getLineCount({ sublistId: 'line' });

            // log.debug('Total Lines is:' , lineCount);

            for (var i = 0; i < lineCount; i++) {
                var debitAmount = newRecord.getSublistValue({
                    sublistId: 'line',
                    fieldId: 'debit',
                    line: i
                });

                log.debug('Debit Amount' + 'Line' + i, debitAmount);

                if (debitAmount) {
                    totalDebit += parseFloat(debitAmount);
                }
            }
            log.debug('total Debit is:' , totalDebit);    
            
            newRecord.setValue({
                    fieldId: 'custbody_total_debit',
                    value: totalDebit,
                    ignoreFieldChange: true
                });

            } catch (error) {
                log.error("Error Updating Total Debit", error.message);
            }
        
    }

    return {
        beforeSubmit: beforeSubmit
    };

});
