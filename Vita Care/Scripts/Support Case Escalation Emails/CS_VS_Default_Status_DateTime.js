/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/log'], function (currentRecord, log) {

    function fieldChanged(context) {
        try {
            var currentRec = currentRecord.get();
            var changedField = context.fieldId;

            if (changedField === 'status') {
                var now = new Date();

                currentRec.setValue({ fieldId: 'custevent_vs_status_change_datetime', value: now });

                var statusValue = currentRec.getValue({ fieldId: 'status' });

                if (statusValue === '5') { // Status = Closed
                    var escalationTimeStr = currentRec.getText({ fieldId: 'custevent_vs_time_case_escalated' });

                    if (escalationTimeStr) {
                        var parsedEscalationDate = parseCustomDateTime(escalationTimeStr);

                        if (parsedEscalationDate) {
                            var diffMs = now - parsedEscalationDate;
                            var diffMinutes = Math.floor(diffMs / (1000 * 60));
                            var days = Math.floor(diffMinutes / (60 * 24));
                            var hours = Math.floor((diffMinutes % (60 * 24)) / 60);
                            var minutes = diffMinutes % 60;

                            var diffString = `${days} days, ${hours} hours, ${minutes} minutes`;

                            currentRec.setValue({ fieldId: 'custevent_vs_time_case_closed', value: diffString });

                            log.debug('Time Difference Set', diffString);
                        } else {
                            log.error('Date Parse Failed', 'Could not parse escalation time: ' + escalationTimeStr);
                        }
                    }
                } else if (statusValue === '2') { // Status = In Progress
                    var nowFormatted = formatDateToCustomString(now);
                    currentRec.setValue({ fieldId: 'custevent_vs_in_progress_status_date', value: nowFormatted });
                    log.debug('In Progress Status Date Set', nowFormatted);
                }
            }
        } catch (e) {
            log.error('Error in fieldChanged', e.toString());
        }
    }

    function parseCustomDateTime(dateTimeStr) {
        try {
            var dateTimeParts = dateTimeStr.split(' ');
            if (dateTimeParts.length < 3) return null;

            var datePart = dateTimeParts[0];
            var timePart = dateTimeParts[1];
            var ampm = dateTimeParts[2].toUpperCase();

            var [day, month, year] = datePart.split('/').map(Number);
            var [hour, minute, second] = timePart.split(':').map(Number);

            if (ampm === 'PM' && hour !== 12) hour += 12;
            if (ampm === 'AM' && hour === 12) hour = 0;

            return new Date(year, month - 1, day, hour, minute, second);
        } catch (err) {
            log.error('Date Parse Error', err.toString());
            return null;
        }
    }

    function formatDateToCustomString(date) {
        var day = ('0' + date.getDate()).slice(-2);
        var month = ('0' + (date.getMonth() + 1)).slice(-2);
        var year = date.getFullYear();

        var hours = date.getHours();
        var minutes = ('0' + date.getMinutes()).slice(-2);
        var ampm = hours >= 12 ? 'pm' : 'am';

        hours = hours % 12;
        hours = hours ? hours : 12; // 0 becomes 12

        return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
    }

    return {
        fieldChanged: fieldChanged
    };
});
