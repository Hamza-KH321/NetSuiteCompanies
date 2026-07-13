/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record'], function(record) {

    function beforeSubmit(context) {
        // Only trigger for create and edit actions
        if (context.type !== context.UserEventType.CREATE &&
            context.type !== context.UserEventType.EDIT) {
            return;
        }

        var newRecord = context.newRecord;

        // Ensure this runs for the correct custom record type
        if (newRecord.type !== 'customsale_vs_dp_tt') {
            return;
        }

        var lineCount = newRecord.getLineCount({ sublistId: 'item' });

        for (var i = 0; i < lineCount; i++) {
            newRecord.setSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                line: i,
                value: 0.00
            });
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
