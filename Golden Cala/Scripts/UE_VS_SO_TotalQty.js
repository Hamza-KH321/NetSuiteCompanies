/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function (record, log) {

    function beforeSubmit(context) {
        try {
            if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
                return;
            }

            var newRecord = context.newRecord;
            var totalQuantity = 0;

            var lineCount = newRecord.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < lineCount; i++) {
                var quantity = newRecord.getSublistValue({sublistId: 'item',fieldId: 'quantity',line: i}) || 0;
                totalQuantity += parseFloat(quantity);
            }

            newRecord.setValue({fieldId: 'custbody_vs_total_qty',value: totalQuantity});
            log.debug({ title: 'Total Quantity Updated', details: `Total Quantity: ${totalQuantity}` });

        } catch (error) {
            log.error({ title: 'Error in beforeSubmit', details: error });
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };

});
