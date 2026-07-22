/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/currentRecord'], function (currentRecord) {

    function fieldChanged(context) {
        try {
            var rec = context.currentRecord;
            var fieldId = context.fieldId;

            if (fieldId === 'customer') {
                rec.setValue({fieldId: 'undepfunds',value: false});
                rec.setValue({fieldId: 'account',value: 220});
            }
        } catch (e) {
            console.error('Error in fieldChanged:', e.message);
        }
    }

    return {
        fieldChanged: fieldChanged
    };
});
