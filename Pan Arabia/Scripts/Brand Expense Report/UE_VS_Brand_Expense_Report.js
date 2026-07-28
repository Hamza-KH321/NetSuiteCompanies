/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function(record, log) {

    function beforeSubmit(context) {
        try {
            if (context.type === context.UserEventType.DELETE) {
                return;
            }

            var newRecord = context.newRecord;
            var expenseClass = null;
            var lineCount = newRecord.getLineCount({ sublistId: 'expense' });

            if (lineCount > 0) {
                for (var i = 0; i < lineCount; i++) {
                    var classValue = newRecord.getSublistValue({sublistId: 'expense',fieldId: 'class',line: i});

                    if (classValue) {
                        expenseClass = classValue;
                        log.debug("Found First Non-Empty Class", expenseClass);
                        break; 
                    }
                }

                if (expenseClass) {
                    newRecord.setValue({fieldId: 'custbody_vs_expense_brand',value: expenseClass});

                    log.debug("Updated custbody_vs_expense_brand", expenseClass);
                }
            }

        } catch (error) {
            log.error("Error in beforeSubmit", error);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
