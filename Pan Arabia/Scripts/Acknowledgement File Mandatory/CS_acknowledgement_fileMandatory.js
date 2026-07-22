/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */

define(['N/record', 'N/ui/message', 'N/currentRecord'], function(record, message, currentRecord) {
    
    function fieldChanged(context) {
        var currentRecord = context.currentRecord;
        var fieldId = context.fieldId;
        
        // Check if the field changed is the checkbox field
        if (fieldId === 'custbody_vs_acknowledgement') {
            // Get the value of the checkbox field
            var isChecked = currentRecord.getValue({
                fieldId: 'custbody_vs_acknowledgement'
            });
            
            // If checkbox is checked, make the other field mandatory
            if (isChecked) {
                currentRecord.getField({
                    fieldId: 'custbody_vs_fileattachment'
                }).isMandatory = true;
            } else {
                currentRecord.getField({
                    fieldId: 'custbody_vs_fileattachment'
                }).isMandatory = false;
            }
        }
    }
    
    return {
        fieldChanged: fieldChanged
    };
});
