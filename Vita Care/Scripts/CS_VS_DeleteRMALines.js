/**
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/currentRecord'],
    function(log, currentRecord) {
       
        /**
         * Function definition to be triggered before record is saved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current record
         * @Since 2015.2
         */
        function saveRecord(scriptContext) {
            try {
                var transactionRecord = currentRecord.get();
                var lineCount = transactionRecord.getLineCount({ sublistId: 'item' });
                log.debug({ title: 'Number of lines is', details: lineCount });
    
                for (var i = lineCount - 1; i >= 0; i--) {
                    var lineItems = transactionRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_vs_rma',
                        line: i
                    });
                    log.debug({ title: 'Items:', details: lineItems });
    
                    if (lineItems === false) {
                        transactionRecord.removeLine({
                            sublistId: 'item',
                            line: i,
                            ignoreRecalc: true
                        });
                    }
                }
                return true;
            } catch (error) {
                log.error('ERRORRRRRRRR!!' , error);
            }
        }
    
        return {
            saveRecord: saveRecord
        };
        
    });
