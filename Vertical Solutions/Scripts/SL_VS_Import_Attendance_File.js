/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/file', 'N/task', 'N/log'],
    function (serverWidget, file, task, log) {
        function onRequest(context) {
try {
                if (context.request.method === 'GET') {
                    // Create a form
                    var form = serverWidget.createForm({
                        title: 'File Upload Form'
                    });
    
                    // Add a file field to the form
                    var fileField = form.addField({
                        id: 'custpage_file',
                        type: serverWidget.FieldType.FILE,
                        label: 'Upload File'
                    });
    
                    // Add a submit button
                    form.addSubmitButton({
                        label: 'Submit'
                    });
    
                    // Display the form
                    context.response.writePage(form);
                } else {
                    // Handle file upload
                    var uploadedFile = context.request.files.custpage_file;
    
                    if (uploadedFile) {
                        // Ensure the file name and type are correctly passed
                        var fileObj = file.create({
                            name: uploadedFile.fileName || 'uploaded_file.csv', // Provide a default name if needed
                            fileType: uploadedFile.fileType,
                            contents: uploadedFile.getContents(),
                            folder: 160 // Replace 456 with the correct folder ID you found
                        });
    
                        var fileId = fileObj.save();
                        log.debug('File Uploaded Successfully', 'File ID: ' + fileId);
    
                        // Create a Map/Reduce task
                        var mrTask = task.create({
                            taskType: task.TaskType.MAP_REDUCE,
                            scriptId: 'customscript_vs_mr_createattendance', // Replace with your Map/Reduce script ID
                            deploymentId: 'customdeploy1', // Replace with your Map/Reduce deployment ID
                            params: {
                                'custscript_file_id': fileId  // Pass the file ID to the Map/Reduce script
                            }
                        });
    
                        try {
                            var taskId = mrTask.submit();
                            log.debug('Map/Reduce Task Submitted', 'Task ID: ' + taskId);
    
                            // Provide feedback to the user
                            context.response.write('File uploaded successfully and sent to Map/Reduce script. Task ID: ' + taskId);
                        } catch (e) {
                            log.error('Error Submitting Map/Reduce Task', e.message);
                            context.response.write('Error submitting Map/Reduce task: ' + e.message);
                        }
                    } else {
                        context.response.write('No file uploaded.');
                    }
                }
} catch (error) {
    log.error('ERRORRRR!!' , error);
}
        }

        return {
            onRequest: onRequest
        };
    });
