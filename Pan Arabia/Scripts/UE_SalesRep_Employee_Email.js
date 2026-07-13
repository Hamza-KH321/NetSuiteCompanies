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
            var salesRepText = newRecord.getValue({ fieldId: 'salesrep' });

            if (salesRepText) {
                newRecord.setValue({fieldId: 'custbody_vs_sales_rep_email',value: salesRepText});

                log.debug("Sales Rep Updated", "Set custbody_vs_sales_rep_email to: " + salesRepText);
            }
        } catch (error) {
            log.error("Error in beforeSubmit", error);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
