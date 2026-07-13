/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Vendor Type Validation
 */
define(['N/runtime', 'N/ui/message'], function (runtime, message) {

    function fieldChanged(context) {
        try {
            console.log("fieldChanged triggered");

            var currentRecord = context.currentRecord;
            var fieldId = context.fieldId;

            // Only run for custentity_vs_type
            if (fieldId !== 'custentity_vs_type') {
                return;
            }

            console.log("Vendor Type field changed");

            // Get field text
            var vendorTypeText = currentRecord.getText({ fieldId: 'custentity_vs_type' });

            console.log("Selected Vendor Type Text: " + vendorTypeText);

            // Allowed User IDs
            var allowedUsers = ['507172', '99130'];

            // Current User
            var currentUserId = runtime.getCurrentUser().id;

            console.log("Current User ID: " + currentUserId);

            // Check if Non-Trade Supplier selected
            if (vendorTypeText === 'Non-Trade Supplier') {

                // If user not allowed
                if (allowedUsers.indexOf(String(currentUserId)) === -1) {

                    console.log("User not allowed to select this value");

                    // Show warning message
                    message.create({
                        title: "Access Denied",
                        message: "You don't have access to choose this vendor type.",
                        type: message.Type.ERROR
                    }).show({
                        duration: 5000
                    });

                    // Clear the field
                    currentRecord.setValue({ fieldId: 'custentity_vs_type', value: '' });

                    console.log("Field cleared successfully");
                }
            }

        } catch (e) {
            console.log("Error in fieldChanged: " + e.message);
        }
    }

    return {
        fieldChanged: fieldChanged
    };

});
