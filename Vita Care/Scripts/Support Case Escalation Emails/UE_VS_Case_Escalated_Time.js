/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

define(['N/record', 'N/log', 'N/format'], function (record, log, format) {

    function afterSubmit(context) {
        try {
            var newRec = context.newRecord;

            // Get the internal ID of the case
            var caseId = newRec.id;

            // Format the current datetime
            var nowFormatted = format.format({
                value: new Date(),
                type: format.Type.DATETIME
            });

            // Update the field on the record
            record.submitFields({
                type: record.Type.SUPPORT_CASE,
                id: caseId,
                values: {
                    custevent_vs_time_case_escalated: nowFormatted
                }
            });

            log.audit('Escalation Time Set', `Case ID ${caseId} updated with escalation time: ${nowFormatted}`);

        } catch (e) {
            log.error('Error in afterSubmit', e.toString());
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
