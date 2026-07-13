/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define([],
    /**
     * @param {record} record
     * @param {search} search
      * @param {message} message
     */
    function() {
       
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type
         * @param {Form} scriptContext.form - Current form
         * @Since 2015.2
         */
    
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function beforeSubmit(scriptContext) {
                var transactionRecord = scriptContext.newRecord;
                var lineCount = transactionRecord.getLineCount({sublistId: 'item'});
                log.debug({title: 'number of lines is', details: lineCount});

                for (var i = lineCount -1 ; i >= 0; i--) {
                    var lineItems = transactionRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_vs_rma',
                        line: i
                    })
                    log.debug({ title: 'Items:', details: lineItems});
                    
                        if(lineItems == false){
                            transactionRecord.removeLine({
                                sublistId: 'item',
                                line: i,
                                ignoreRecalc: true
                            })
                        }
                      }
        }
    
        return {
    
            beforeSubmit: beforeSubmit,
    
        };
        
    });
    