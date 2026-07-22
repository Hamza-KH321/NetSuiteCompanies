/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

define(['N/record'], function(record) {
    
    function afterSubmit(context) {
        if (context.type === context.UserEventType.CREATE || context.type === context.UserEventType.EDIT) {
            var newRecord = context.newRecord;
            var lineCount = newRecord.getLineCount({
                sublistId: 'item'
            });
            
            // Update custom field with line count
            try {
                record.submitFields({
                    type: record.Type.ESTIMATE,
                    id: newRecord.id,
                    values: {
                        custbody_vs_numberoflines: lineCount
                    }
                });
            } catch (e) {
                log.error({
                    title: 'Error Updating Field',
                    details: e
                });
            }
        }
    }
    
    return {
        afterSubmit: afterSubmit
    };
});
