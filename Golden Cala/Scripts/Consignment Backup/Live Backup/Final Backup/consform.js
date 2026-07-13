/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/currentRecord', 'N/record', 'N/ui/serverWidget', 'N/file', 'N/format', 'N/task', 'N/redirect', 'N/runtime'],
    /**
 * @param{currentRecord} currentRecord
 * @param{record} record
 */
    (currentRecord, record, serverWidget, file, format, task, redirect, runtime) => {

      
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var upload_file_field;
            var selectField;
             var taskId = scriptContext.request.parameters.custparam_taskid;

            if (scriptContext.request.method === 'GET') {
                var form = serverWidget.createForm({ title: 'Upload Report' });
                upload_file_field = form.addField({ id: 'cust_page_file', type: serverWidget.FieldType.FILE, label: 'choose a file' });
                selectField = form.addField({ id: 'custpage_select', type: serverWidget.FieldType.SELECT, label: 'Select', source: 'customlist_customer_list_sheet' });
                upload_file_field.isMandatory = true;
                form.addSubmitButton({ label: 'Submit' });


              if (taskId) {
                    var status = task.checkStatus(taskId);

                    // Logging the status information
                    log.debug('Map/Reduce Task Status', {
                        stage: status.stage,
                        status: status.status,
                        percentageCompleted: status.getPercentageCompleted(),
                    });
                    if (status.status != task.TaskStatus.COMPLETE) {
                        form.addField({
                            id: 'custpage_status',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: 'Status',
                            container: 'custpage_task_status'
                        }).defaultValue = '<div style="text-align:left">' +
                        '<div style="color:red"><h2>Processing. Please wait...</h2></div>' +
                        '<div>Percentage Completed: ' + status.getPercentageCompleted() + '%</div>' +
                        '<div>Current Stage: ' + status.stage + '</div>' +
                            '</div>';
                    } else if (status.status == task.TaskStatus.COMPLETE) {
                        form.addField({
                            id: 'custpage_status',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: 'Status',
                            container: 'custpage_task_status'

                        }).defaultValue = '<h2 style="color:green;align:center">Task completed</h2>';
                    }
                }




              
                scriptContext.response.writePage(form);
            }
            else if (scriptContext.request.method === 'POST') {
                var customer_id = scriptContext.request.parameters.custpage_select;
                var fileObj = scriptContext.request.files.cust_page_file;
                //var fileRecord = file.create({ name: fileObj.name, fileType: fileObj.fileType, content: fileObj.getContents(), folder: 1926 });
                fileObj.folder = 2256;
                var id = fileObj.save();

                var mapReduceTask = task.create({ taskType: task.TaskType.MAP_REDUCE });
                mapReduceTask.scriptId = 'customscript742';
                mapReduceTask.deploymentId = 'customdeploy1';

                log.debug('my id', id);
                mapReduceTask.params = {
                    'custscript_vs_cons_file_id2': id+'/'+customer_id
                };
                log.debug('mapReduceTask', mapReduceTask);

                var taskId = mapReduceTask.submit();

               var params = {
                        custparam_taskid: taskId,
                    };
                    redirect.toSuitelet({
                        scriptId: runtime.getCurrentScript().id,
                        deploymentId: runtime.getCurrentScript().deploymentId,
                        parameters: params
                    });
            }
        }

        return { onRequest }

    });