/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Invoice CustomGL Validation
 */
define(['N/log', 'N/ui/message'], function (log, message) {

    function fieldChanged(context) {
        try {

            var currentRecord = context.currentRecord;
            var sublistId = context.sublistId;
            var fieldId = context.fieldId;

            log.debug('fieldChanged Triggered', {
                sublistId: sublistId,
                fieldId: fieldId
            });

            if (sublistId != 'recmachcustrecord_vs_parent') {
                return;
            }

            if (fieldId != 'custrecord_vs_credit_quantity' &&
                fieldId != 'custrecord_vs_jv_quantity') {
                return;
            }

            var originalQty = parseFloat(currentRecord.getCurrentSublistValue({ sublistId: sublistId, fieldId: 'custrecord_vs_original_quantity' })) || 0;
            var creditQty = parseFloat(currentRecord.getCurrentSublistValue({ sublistId: sublistId, fieldId: 'custrecord_vs_credit_quantity' })) || 0;
            var jvQty = parseFloat(currentRecord.getCurrentSublistValue({ sublistId: sublistId, fieldId: 'custrecord_vs_jv_quantity' })) || 0;

            log.debug('Quantities', {
                originalQty: originalQty,
                creditQty: creditQty,
                jvQty: jvQty
            });

            if (creditQty < 0 || jvQty < 0) {

                message.create({
                    title: 'Validation Error',
                    message: 'Negative quantity is not allowed.',
                    type: message.Type.ERROR
                }).show({
                    duration: 5000
                });

                currentRecord.setCurrentSublistValue({
                    sublistId: sublistId,
                    fieldId: fieldId,
                    value: 0
                });

                return;
            }

            var deductedJvQty = parseFloat(currentRecord.getCurrentSublistValue({ sublistId: sublistId, fieldId: 'custrecord_vs_jv_qty_deducted' })) || 0;
            var deductedCreditQty = parseFloat(currentRecord.getCurrentSublistValue({ sublistId: sublistId, fieldId: 'custrecord_vs_credit_qty_deducted' })) || 0;
            var historicalUsedQty = deductedJvQty + deductedCreditQty;
            var currentUsedQty = creditQty + jvQty;
            var totalUsed = historicalUsedQty + currentUsedQty;
            var remainingQty = originalQty - totalUsed;

            log.debug('Calculation', {
                deductedJvQty: deductedJvQty,
                deductedCreditQty: deductedCreditQty,
                historicalUsedQty: historicalUsedQty,
                currentUsedQty: currentUsedQty,
                totalUsed: totalUsed,
                remainingQty: remainingQty
            });

            if (totalUsed > originalQty) {

                message.create({
                    title: 'Validation Error',
                    message: 'Total used quantity cannot exceed Original Quantity.',
                    type: message.Type.ERROR
                }).show({
                    duration: 5000
                });

                currentRecord.setCurrentSublistValue({ sublistId: sublistId, fieldId: fieldId, value: 0 });

                return;
            }

            currentRecord.setCurrentSublistValue({
                sublistId: sublistId,
                fieldId: 'custrecord_vs_remaining_quantity',
                value: remainingQty,
                ignoreFieldChange: true
            });

            log.debug('Remaining Updated', remainingQty);

            if (remainingQty == 0) {

                log.debug('Remaining Quantity Reached Zero', 'No more quantities allowed');

            }

        } catch (e) {

            log.error('fieldChanged Error', e);

            message.create({
                title: 'Script Error',
                message: 'Error: ' + (e.message || e),
                type: message.Type.ERROR
            }).show({
                duration: 5000
            });
        }
    }

    return {
        fieldChanged: fieldChanged
    };

});