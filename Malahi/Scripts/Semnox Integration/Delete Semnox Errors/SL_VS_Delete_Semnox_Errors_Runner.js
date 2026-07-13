/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Delete Semnox Errors Runner
 */

define(['N/ui/serverWidget', 'N/task', 'N/log', 'N/redirect', 'N/runtime'],
    function (serverWidget, task, log, redirect, runtime) {

        function onRequest(context) {
            try {

                log.debug('Suitelet', 'Start');

                var taskId = context.request.parameters.custparam_taskid;

                if (context.request.method == 'GET') {

                    var form = serverWidget.createForm({
                        title: 'Delete Semnox Errors'
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
                        id: 'custpage_task_status',
                        label: 'Task Status'
                    });

                    form.addSubmitButton({
                        label: 'Delete Records'
                    });

                    // ===== STATUS SECTION =====
                    if (taskId) {

                        log.debug('Checking Task Status', taskId);

                        var status = task.checkStatus(taskId);

                        log.debug('Task Status', JSON.stringify(status));

                        var percentage = 0;
                        if (status.getPercentageCompleted) {
                            percentage = status.getPercentageCompleted();
                        }

                        var stage = status.stage;
                        if (!stage) {
                            stage = 'Pending...';
                        }

                        var statusHtml = '';

                        if (status.status != task.TaskStatus.COMPLETE) {

                            statusHtml =
                                '<div style="text-align:left">' +
                                '<div style="color:red"><h2>Processing... Please wait</h2></div>' +
                                '<div><b>Progress:</b> ' + percentage + '%</div>' +
                                '<div><b>Stage:</b> ' + stage + '</div>' +
                                '</div>' +
                                '<script>setTimeout(function(){ location.reload(); }, 5000);</script>';

                        } else {

                            statusHtml =
                                '<h2 style="color:green;">Deletion Completed Successfully</h2>';
                        }

                        form.addField({
                            id: 'custpage_status',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: 'Status',
                            container: 'custpage_task_status'
                        }).defaultValue = statusHtml;
                    }

                    context.response.writePage(form);

                } else {

                    var fromDate = context.request.parameters.custpage_from_date;
                    var toDate = context.request.parameters.custpage_to_date;

                    log.debug('POST Params', {
                        fromDate: fromDate,
                        toDate: toDate
                    });

                    if (!fromDate || !toDate) {
                        throw new Error('Both dates are required');
                    }

                    var mrTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: 'customscript_vs_mr_delete_semnox_errors_',
                        deploymentId: 'customdeploy_vs_mr_delete_semnox_errors_',
                        params: {
                            custscript_vs_from_date: String(fromDate),
                            custscript_vs_to_date: String(toDate)
                        }
                    });

                    var newTaskId = mrTask.submit();

                    log.audit('MR Submitted', newTaskId);

                    // ===== REDIRECT TO SHOW STATUS =====
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

        return {
            onRequest: onRequest
        };
    });