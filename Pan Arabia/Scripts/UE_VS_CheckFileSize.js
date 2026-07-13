/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/log', 'N/file', 'N/ui/message'], function(log, file, message) {

    function beforeSubmit(context) {
        try {
            var newRecord = context.newRecord;
            var fileId = newRecord.getValue({ fieldId: 'custbody_vs_fileattachment' }); // Replace with your custom field ID

            if (fileId) {
                // Load the file using the file ID
                var uploadedFile = file.load({ id: fileId });
                var fileSizeInBytes = uploadedFile.size; // Size in bytes
                log.debug({
                    title: 'File Size Bytes',
                    details: 'File Size Bytes: ' + fileSizeInBytes + ' MB'
                });

                // Convert bytes to megabytes
                var fileSizeInMB = fileSizeInBytes / (1024 * 1024);

                log.debug({
                    title: 'File Size MB',
                    details: 'File Size MB: ' + fileSizeInMB.toFixed(3) + ' MB'
                });

                // Check if file size exceeds the limit
                if (fileSizeInMB.toFixed(3) >= 0.280) {
                    // Show an alert or message to the user
                    var errorMessage = 'File size exceeds the limit. Please upload a file with size less than 500 MB.';
                    showMessage(errorMessage);
                    // Cancel record submission
                    context.cancel = true;
                }
            }
        } catch (error) {
            log.error('Error in beforeSubmit function', error);
        }
    }

    function showMessage(messageText) {
        var msg = message.create({
            title: 'File Size Limit Exceeded',
            message: messageText,
            type: message.Type.ERROR
        });
        msg.show();
    }

    return {
        beforeSubmit: beforeSubmit
    };

});
