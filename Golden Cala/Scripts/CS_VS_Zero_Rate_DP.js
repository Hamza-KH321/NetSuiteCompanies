/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/currentRecord'], function(currentRecord) {

    function fieldChanged(context) {
        try {
            // Ensure the change is happening in the correct sublist and field
            if (context.fieldId === 'item') {
                // Get the current record
                var rec = currentRecord.get();

                // Use setTimeout to delay setting the rate field
                setTimeout(function() {
                    rec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: 0.00,
                        // ignoreFieldChange: true // Avoid triggering additional field changes
                    });
                }, 500); // Delay of 200ms

                // Use setTimeout to delay setting the rate field
                setTimeout(function() {
                    rec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        value: 0.00,
                        // ignoreFieldChange: true // Avoid triggering additional field changes
                    });
                }, 500); // Delay of 200ms
            }
        } catch (e) {
            console.error('Error in fieldChanged function', e);
        }
    }

    return {
        fieldChanged: fieldChanged
    };
});
