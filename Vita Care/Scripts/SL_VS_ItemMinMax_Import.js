/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/task', 'N/log'],
    function(serverWidget, task, log) {

        function onRequest(context) {
            if (context.request.method === 'GET') {
                var form = serverWidget.createForm({ title: 'Upload CSV File' });

                var fileField = form.addField({
                    id: 'custpage_csv_file',
                    type: serverWidget.FieldType.FILE,
                    label: 'CSV File'
                });

                form.addSubmitButton({ label: 'Process File' });
                context.response.writePage(form);

            } else if (context.request.method === 'POST') {
                var uploadedFile = context.request.files['custpage_csv_file'];
                if (!uploadedFile) {
                    throw new Error('No file uploaded.');
                }

                var fileContents = uploadedFile.getContents();
                
                log.audit('CSV File Contents', fileContents.substring(0, 500)); 

                var deleteTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: 'customscript_vs_mr_item_min_max_delete', 
                    deploymentId: 'customdeploy1',
                    params: { custscript_vs_csv_data: fileContents }
                });

                var deleteTaskId = deleteTask.submit();
                log.audit('Deletion Map/Reduce Triggered', 'Task ID: ' + deleteTaskId);

                context.response.write('File uploaded. Deletion process started.');
            }
        }

        return { onRequest };
    });
