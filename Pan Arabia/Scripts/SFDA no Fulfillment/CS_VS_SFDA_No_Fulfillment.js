/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/ui/dialog', 'N/log'], function(dialog, log) {

    function saveRecord(context) {
        var currentRecord = context.currentRecord;

        // Get the value of the 'createdfrom' field as text
        var createdFromText = currentRecord.getText({
            fieldId: 'createdfrom'
        });

        // Log the value of 'createdfrom'
        // log.debug({
        //     title: 'Created From Text',
        //     details: createdFromText
        // });

        // Check if the first 5 letters of 'createdfrom' are "Sales"
        if (createdFromText && createdFromText.startsWith('Sales')) {
            var sublistId = 'item'; // Replace 'item' with the correct sublist ID if necessary
            var lineCount = currentRecord.getLineCount({ sublistId: sublistId });

            for (var i = 0; i < lineCount; i++) {
                var locationValue = currentRecord.getSublistValue({
                    sublistId: sublistId,
                    fieldId: 'location',
                    line: i
                });

                if (locationValue == 1) {
                    var message = 'You can\'t issue items from SFDA Warehouse.';
                    dialog.alert({
                        title: 'Validation',
                        message: message
                    });
                    return false; // Prevent the record from being saved
                }
            }
        }

        return true; // Allow the record to be saved if validation passes or no action is needed
    }

    return {
        saveRecord: saveRecord
    };
});
