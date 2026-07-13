/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || DueDate Default Value
 */
define(['N/log'], function (log) {

    function beforeSubmit(context) {
        try {

            // Run ONLY on Create
            if (context.type !== context.UserEventType.CREATE) {
                log.debug('Not Create Event', 'Exit script');
                return;
            }
            log.debug('beforeSubmit Triggered', context.type);

            var rec = context.newRecord;

            var dueDate = rec.getValue({ fieldId: 'duedate' });

            log.debug('Original Due Date', dueDate);

            var baseDate;

            if (dueDate) {
                baseDate = new Date(dueDate);
            } else {
                baseDate = new Date();
            }

            if (!baseDate || isNaN(baseDate.getTime())) {
                log.error('Invalid Base Date', baseDate);
                return;
            }

            var year = baseDate.getFullYear();
            var month = baseDate.getMonth(); // 0-based

            // Move to next month
            month = month + 1;

            if (month > 11) {
                month = 0;
                year = year + 1;
            }

            // First day of next month
            var newDueDate = new Date(year, month, 1);

            log.debug('New Due Date', newDueDate);

            rec.setValue({ fieldId: 'duedate', value: newDueDate });

        } catch (e) {
            log.error('Error in beforeSubmit', e);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };

});
