/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log', 'N/runtime'], function(record, log, runtime) {

    function beforeSubmit(context) {
        if (context.type === context.UserEventType.CREATE || context.type === context.UserEventType.EDIT) {
            var newRecord = context.newRecord;

            // Get today's date
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            log.debug({title: 'Today\'s Date is:',details: today})

            // Get the invoice date from the record
            var invoiceDate = newRecord.getValue({
                fieldId: 'trandate'
            });
            log.debug({title: 'Invoice Date is:',details: invoiceDate})

            // Compare the invoice date with today's date
            if (invoiceDate > today) {
                // If invoice date is greater than today, set it to today's date
                newRecord.setValue({
                    fieldId: 'trandate',
                    value: today
                });
            }
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };

});
