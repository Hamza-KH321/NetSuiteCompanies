/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Pixel Error Log Cleanup
 */

define(['N/ui/serverWidget', 'N/task', 'N/log', 'N/redirect', 'N/runtime'],
    function (serverWidget, task, log, redirect, runtime) {

        function onRequest(context) {
            try {

                log.debug('Suitelet', 'Pixel Error Log Cleanup Start');

                var taskId = context.request.parameters.custparam_taskid;

                if (context.request.method == 'GET') {

                    var form = serverWidget.createForm({
                        title: 'Pixel Error Log Cleanup'
                    });

                    form.addField({
                        id: 'custpage_from_date',
                        type: serverWidget.FieldType.DATE,
                        label: 'From Date'
                    });

                    form.addField({
                        id: 'custpage_to_date',
                        type: serverWidget.FieldType.DATE,
                        label: 'To Date'
                    });

                    form.addFieldGroup({
                        id: 'custpage_status_group',
                        label: 'Task Status'
                    });

                    form.addSubmitButton({
                        label: 'Run Cleanup'
                    });

                    if (taskId) {

                        var status = task.checkStatus(taskId);

                        var percentage = 0;
                        if (status.getPercentageCompleted) {
                            percentage = status.getPercentageCompleted();
                        }

                        var stage = status.stage;
                        if (!stage) {
                            stage = 'Pending...';
                        }

                        var html = '';

                        if (status.status != task.TaskStatus.COMPLETE) {

                            html =
                                '<div style="color:red"><h2>Processing...</h2></div>' +
                                '<div><b>Percentage:</b> ' + percentage + '%</div>' +
                                '<div><b>Stage:</b> ' + stage + '</div>' +
                                '<script>setTimeout(function(){ location.reload(); }, 10000);</script>';

                        } else {

                            html = '<h2 style="color:green;">Cleanup Completed Successfully</h2>';
                        }

                        form.addField({
                            id: 'custpage_status',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: 'Status',
                            container: 'custpage_status_group'
                        }).defaultValue = html;
                    }

                    context.response.writePage(form);

                } else {

                    var fromDate = context.request.parameters.custpage_from_date;
                    var toDate = context.request.parameters.custpage_to_date;

                    log.debug('POST Dates', 'From: ' + fromDate + ' | To: ' + toDate);

                    if (!fromDate || !toDate) {
                        throw new Error('Both dates are required.');
                    }

                    var mrTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: 'customscript_vs_mr_pixel_error_log_clean',
                        deploymentId: 'customdeploy_vs_mr_pixel_error_log_clean',
                        params: {
                            custscript_vs_from_date_delete: fromDate,
                            custscript_vs_to_date_delete: toDate
                        }
                    });

                    var newTaskId = mrTask.submit();

                    log.debug('MR Submitted', newTaskId);

                    redirect.toSuitelet({
                        scriptId: runtime.getCurrentScript().id,
                        deploymentId: runtime.getCurrentScript().deploymentId,
                        parameters: {
                            custparam_taskid: newTaskId
                        }
                    });
                }

            } catch (e) {
                log.error('Suitelet Error', e);
                context.response.write('Error: ' + e.message);
            }
        }

        return { onRequest: onRequest };
    });