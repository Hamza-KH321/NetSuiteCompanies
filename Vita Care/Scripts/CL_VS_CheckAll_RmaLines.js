/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/ui/message'], function (currentRecord, message) {

    // Function to execute on page load
    function pageInit(context) {
        // This can be left empty or used for other initializations if needed
    }

    // Function to check all items in the sublist when the button is clicked
    function checkAllItems() {
        var rec = currentRecord.get(); // Get the current record
        var lineCount = rec.getLineCount({ sublistId: 'item' }); // Replace 'item' with your actual sublist ID

        // Loop through all lines in the sublist and check the field
        for (var i = 0; i < lineCount; i++) {
            rec.selectLine({ sublistId: 'item', line: i }); // Select the line
            rec.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_vs_rma', // Replace with your field ID
                value: true, // Set the checkbox to true (checked)
                ignoreFieldChange: true
            });
            rec.commitLine({ sublistId: 'item' }); // Commit the changes
        }

        // Show success message to the user
        message.create({
            title: 'Success',
            message: 'All items have been checked.',
            type: message.Type.CONFIRMATION
        }).show();
    }

    return {
        pageInit: pageInit,
        checkAllItems: checkAllItems // Expose the function for the button to call
    };
});
