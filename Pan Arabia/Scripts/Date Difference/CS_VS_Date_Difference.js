/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/record', 'N/currentRecord'], function(record, currentRecord) {

    function fieldChanged(context) {
        var currentRec = context.currentRecord;
        var fieldId = context.fieldId;

        if (fieldId === 'startdate' || fieldId === 'enddate') {
            var startDate = currentRec.getValue('startdate');
            var endDate = currentRec.getValue('enddate');

            if (startDate && endDate) {
                var diffInMs = new Date(endDate) - new Date(startDate);
                var diffInDays = diffInMs / (1000 * 60 * 60 * 24);

                if (diffInDays > 90) {
                    currentRec.setValue('custbody_vs_approval_initial', true);
                    log.debug('Difference is more than 90 days' , diffInDays);
                } else {
                    currentRec.setValue('custbody_vs_approval_initial', false);
                    log.debug('Difference is less than 90 days' , diffInDays);
                }
            }
        }
    }

    return {
        fieldChanged: fieldChanged
    };
});
