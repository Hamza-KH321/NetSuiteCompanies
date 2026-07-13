/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/ui/message', 'N/ui/dialog'], function(message, dialog) {
    function fieldChanged(context) {
        var currentRecord = context.currentRecord;
        var fieldName = context.fieldId;

        // Check if the changed field is 'location'
        if (fieldName === 'location') {
            var locationValue = currentRecord.getValue({ fieldId: 'location' });

            // Check if the location value is '1'
            if (locationValue === '1') {
                // Show an alert message
                var message = 'Please choose another warehouse because SFDA is locked. ';
                dialog.alert({
                    title: 'SFDA Validation',
                    message: message
                });
                
                // Optionally, clear the location field to force the user to select another location
                currentRecord.setValue({ fieldId: 'location', value: '' });
            }
        }
    }

    return {
        fieldChanged: fieldChanged
    };
});
