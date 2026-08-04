/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Semnox Integration Runner
 */

define(['N/ui/serverWidget', 'N/task', 'N/log', 'N/redirect', 'N/runtime'],
    function (serverWidget, task, log, redirect, runtime) {

        function onRequest(context) {
            try {

                log.debug('Suitelet', 'Start');

                var taskId = context.request.parameters.custparam_taskid;

                if (context.request.method == 'GET') {

                    var form = serverWidget.createForm({
                        title: 'Semnox Integration Runner'
                    });

                    var dateField = form.addField({
                        id: 'custpage_date',
                        type: serverWidget.FieldType.DATE,
                        label: 'Date'
                    });

                    var typeField = form.addField({
                        id: 'custpage_report_type',
                        type: serverWidget.FieldType.SELECT,
                        label: 'Report Type'
                    });

                    typeField.addSelectOption({ value: '', text: 'Select Type' });
                    typeField.addSelectOption({ value: 'sales', text: 'Sales Report' });
                    typeField.addSelectOption({ value: 'games', text: 'Games Report' });

                    form.addFieldGroup({
                        id: 'custpage_task_status',
                        label: 'Task Status'
                    });

                    form.addSubmitButton({
                        label: 'Run Integration'
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

                        var html = '';

                        if (status.status != task.TaskStatus.COMPLETE) {

                            html =
                                '<div style="text-align:left">' +
                                '<div style="color:red"><h2>Processing... Please wait</h2></div>' +
                                '<div><b>Progress:</b> ' + percentage + '%</div>' +
                                '<div><b>Stage:</b> ' + stage + '</div>' +
                                '</div>' +
                                '<script>setTimeout(function(){ location.reload(); }, 9000);</script>';

                        } else {

                            html =
                                '<h2 style="color:green;">Integration Completed Successfully</h2>';
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

                    var dateVal = context.request.parameters.custpage_date;
                    var reportType = context.request.parameters.custpage_report_type;

                    log.debug('POST Params', {
                        date: dateVal,
                        type: reportType
                    });

                    if (!dateVal || !reportType) {
                        throw new Error('Date and Report Type are required');
                    }

                    if (reportType == 'sales') {

                        var mrTask = task.create({
                            taskType: task.TaskType.MAP_REDUCE,
                            scriptId: 'customscript_vs_mr_semnox_integration_ru',
                            deploymentId: 'customdeploy_vs_mr_semnox_integration_ru',
                            params: {
                                custscript_vs_report_date: dateVal,
                                custscript_vs_report_type: reportType,
                            }
                        });

                    } else if (reportType == 'games') {

                        var mrTask = task.create({
                            taskType: task.TaskType.MAP_REDUCE,
                            scriptId: 'customscript_vs_mr_semnox_integration_g',
                            deploymentId: 'customdeploy_vs_mr_semnox_integration_ga',
                            params: {
                                custscript_vs_report_date2: dateVal,
                                custscript_vs_report_type2: reportType,
                            }
                        });

                    }

                    var newTaskId = mrTask.submit();

                    log.audit('MR Submitted', {
                        taskId: newTaskId,
                        reportType: reportType
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
                log.error('Suitelet Error', e);
                context.response.write('Error: ' + e.message);
            }
        }

        return {
            onRequest: onRequest
        };
    });