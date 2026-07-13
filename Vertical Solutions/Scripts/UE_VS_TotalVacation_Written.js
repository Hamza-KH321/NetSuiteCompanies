/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function (record, log) {

    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.EDIT) return;

        try {
            var employeeRecord = context.newRecord;

            var days = parseInt(employeeRecord.getValue('custentity_vacation_days_emp') || 0, 10);
            var hours = parseInt(employeeRecord.getValue('custentity_vacation_hours_emp') || 0, 10);
            var minutes = parseInt(employeeRecord.getValue('custentity1') || 0, 10);

            log.debug('Original Values', { days: days, hours: hours, minutes: minutes });

            while (minutes < 0 && (hours > 0 || days > 0)) {
                minutes += 60;
                hours -= 1;
            }

            while (hours < 0 && days > 0) {
                hours += 8;
                days -= 1;
            }

            if (days < 0) {
                if (hours > 0) {
                    hours -= 8;
                    days += 1;
                }
                if (minutes > 0) {
                    minutes -= 60;
                    hours += 1;
                }
            }

            var dayLabel = (Math.abs(days) === 1) ? 'Day' : 'Days';
            var hourLabel = (Math.abs(hours) === 1) ? 'Hour' : 'Hours';
            var minuteLabel = (Math.abs(minutes) === 1) ? 'Minute' : 'Minutes';

            var totalBalance = days + ' ' + dayLabel + ' : ' + Math.abs(hours) + ' ' + hourLabel + ' : ' + Math.abs(minutes) + ' ' + minuteLabel;

            employeeRecord.setValue('custentity_total_vacations_balance', totalBalance);

            log.debug('Updated Total Balance', totalBalance);
            
        } catch (error) {
            log.error('ERROR!!', error);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
