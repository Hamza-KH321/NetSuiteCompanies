/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record'], function(record) {
    function beforeSubmit(context) {
        try {
            if (context.type !== context.UserEventType.CREATE) {
                return;
            }

            var newRecord = context.newRecord;
            newRecord.setValue({fieldId: 'isinactive',value: true});

        } catch (error) {
            log.error({
                title: 'Error in beforeSubmit',
                details: error
            });
            throw error; 
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
