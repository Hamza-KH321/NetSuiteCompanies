/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */

define(['N/ui/dialog', 'N/currentRecord'], function (dialog, currentRecord) {

    function validateField(context) {
        try {
            // Only item sublist
            if (context.sublistId !== 'item') {
                return true;
            }

            // Only block Amount field
            if (context.fieldId !== 'amount') {
                return true;
            }

            var rec = currentRecord.get();

            var qty = parseFloat(rec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity' })) || 0;
            var rate = parseFloat(rec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'rate' })) || 0;
            var calculatedAmount = 0;

            if (qty > 0 && rate > 0) {
                calculatedAmount = qty * rate;
            }

            // Reset amount
            rec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: calculatedAmount, ignoreFieldChange: true });

            dialog.alert({ title: 'Action Not Allowed', message: 'You can\'t change amount, please enter quantity and unit price.' });

            return true;

        } catch (e) {
            console.error('validateField error', e);
            return true;
        }
    }

    return {
        validateField: validateField
    };
});
