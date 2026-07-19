/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Bulk Close RMA
 */
define(['N/ui/serverWidget', 'N/task', 'N/log', 'N/redirect', 'N/runtime'],
    function (serverWidget, task, log, redirect, runtime) {

        var CONFIG = {
            FILE_FOLDER_ID: 1917813,
            MR_SCRIPT_ID: 'customscript_vs_mr_close_rma_lines',
            MR_DEPLOYMENT_ID: 'customdeploy_vs_mr_close_rma_lines'
        };

        function onRequest(context) {
            try {

                log.debug('START', 'Close RMA Lines Suitelet Started');

                var taskId = context.request.parameters.custparam_taskid;

                if (context.request.method == 'GET') {

                    var form = serverWidget.createForm({
                        title: 'Close RMA Lines'
                    });

                    var fileField = form.addField({
                        id: 'custpage_rma_file',
                        type: serverWidget.FieldType.FILE,
                        label: 'Upload RMA CSV File'
                    });

                    fileField.isMandatory = true;

                    form.addFieldGroup({
                        id: 'custpage_task_status',
                        label: 'Task Status'
                    });

                    form.addSubmitButton({
                        label: 'Upload and Process'
                    });

                    // ===== STATUS SECTION =====

                    if (taskId) {

                        log.debug('Checking Task Status', taskId);

                        var status = task.checkStatus({
                            taskId: taskId
                        });

                        log.debug('Task Status', {
                            status: status.status,
                            stage: status.stage
                        });

                        var percentage = 0;

                        if (status.getPercentageCompleted) {
                            percentage = status.getPercentageCompleted();
                        }

                        var stage = status.stage;

                        if (!stage) {
                            stage = 'Pending...';
                        }

                        var html = '';

                        if (status.status == task.TaskStatus.COMPLETE) {

                            html =
                                '<div style="padding:15px;">' +
                                    '<h2 style="color:green;">RMA Processing Completed Successfully</h2>' +
                                    '<div><b>Progress:</b> 100%</div>' +
                                    '<div><b>Status:</b> Complete</div>' +
                                '</div>';

                        } else if (status.status == task.TaskStatus.FAILED) {

                            html =
                                '<div style="padding:15px;">' +
                                    '<h2 style="color:red;">RMA Processing Failed</h2>' +
                                    '<div><b>Status:</b> Failed</div>' +
                                    '<div>Please check the Map/Reduce execution logs for more details.</div>' +
                                '</div>';

                        } else {

                            html =
                                '<div style="padding:15px;">' +
                                    '<div style="color:red;">' +
                                        '<h2>Processing... Please wait</h2>' +
                                    '</div>' +
                                    '<div>' +
                                        '<b>Progress:</b> ' + percentage + '%' +
                                    '</div>' +
                                    '<div>' +
                                        '<b>Stage:</b> ' + stage +
                                    '</div>' +
                                    '<br>' +
                                    '<div style="' +
                                        'width:100%;' +
                                        'background-color:#e0e0e0;' +
                                        'border-radius:5px;' +
                                        'overflow:hidden;' +
                                        'height:25px;' +
                                    '">' +
                                        '<div style="' +
                                            'width:' + percentage + '%;' +
                                            'height:25px;' +
                                            'background-color:#4CAF50;' +
                                            'text-align:center;' +
                                            'line-height:25px;' +
                                            'color:white;' +
                                        '">' +
                                            percentage + '%' +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                                '<script>' +
                                    'setTimeout(function(){' +
                                        'location.reload();' +
                                    '}, 10000);' +
                                '</script>';
                        }

                        form.addField({
                            id: 'custpage_status',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: 'Status',
                            container: 'custpage_task_status'
                        }).defaultValue = html;
                    }

                    context.response.writePage(form);

                } else {

                    log.debug('POST', 'Processing Uploaded File');

                    var uploadedFile = context.request.files.custpage_rma_file;

                    if (!uploadedFile) {
                        throw new Error('Please upload a CSV file.');
                    }

                    log.debug('Uploaded File', {
                        name: uploadedFile.name,
                        type: uploadedFile.fileType,
                        size: uploadedFile.size
                    });

                    uploadedFile.folder = CONFIG.FILE_FOLDER_ID;

                    var fileId = uploadedFile.save();

                    log.audit('File Saved', {
                        fileId: fileId,
                        fileName: uploadedFile.name
                    });

                    var mrTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: CONFIG.MR_SCRIPT_ID,
                        deploymentId: CONFIG.MR_DEPLOYMENT_ID,
                        params: {
                            custscript_vs_rma_csv_file_id: fileId
                        }
                    });

                    var newTaskId = mrTask.submit();

                    log.audit('Map Reduce Submitted', {
                        taskId: newTaskId,
                        fileId: fileId
                    });

                    redirect.toSuitelet({
                        scriptId: runtime.getCurrentScript().id,
                        deploymentId: runtime.getCurrentScript().deploymentId,
                        parameters: {
                            custparam_taskid: newTaskId
                        }
                    });
                }

            } catch (e) {

                log.error('Suitelet Error', {
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                });

                context.response.write(
                    'Error: ' + e.message
                );
            }
        }

        return {
            onRequest: onRequest
        };
    });