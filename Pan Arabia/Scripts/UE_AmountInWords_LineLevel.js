/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/format/i18n'],

    function(format) {
       
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type
         * @param {Form} scriptContext.form - Current form
         * @Since 2015.2
         */
        function beforeLoad(scriptContext) {
    
        }
    
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function beforeSubmit(scriptContext) {
          
               var rec = scriptContext.newRecord;
          
            // Get line count
            var lineCount = rec.getLineCount({sublistId: 'item'});
            
            // Iterate through each line item
            for (var i = 0; i < lineCount; i++) {
                var grossamt = rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'grossamt',
                    line: i
                });
    
                // Convert grossamt to words
                var spellOutNum = format.spellOut({
                    number: Number(grossamt),
                    locale: "EN"
                });
    
                // Set the value in the custom field 'custcol_grossamt_in_words' on the line level
                rec.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_grossamt_in_words',
                    line: i,
                    value: spellOutNum
                });
            }
        }
    
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function afterSubmit(scriptContext) {
     
            
        }
    
        return {
            beforeSubmit: beforeSubmit
        };
    });
    