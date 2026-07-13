/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Delete Semnox Invoices
 */

define(['N/ui/serverWidget', 'N/task', 'N/log', 'N/redirect', 'N/runtime'],
    function (serverWidget, task, log, redirect, runtime) {

        function onRequest(context) {
            try {

                log.debug('Suitelet', 'Start');

                var taskId = context.request.parameters.custparam_taskid;

                if (context.request.method == 'GET') {

                    var form = serverWidget.createForm({
                        title: 'Delete Semnox Invoices'
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
                        label: 'Delete Invoices'
                    });

                    // ===== STATUS =====
                    if (taskId) {

                        var status = task.checkStatus(taskId);

                        var percentage = 0;
                        if (status.getPercentageCompleted) {
                            percentage = status.getPercentageCompleted();
                        }

                        var stage = status.stage || 'Pending...';

                        var html = '';

                        if (status.status != task.TaskStatus.COMPLETE) {

                            html =
                                '<div>' +
                                '<h3 style="color:red">Processing...</h3>' +
                                '<div><b>Progress:</b> ' + percentage + '%</div>' +
                                '<div><b>Stage:</b> ' + stage + '</div>' +
                                '</div>' +
                                '<script>setTimeout(function(){ location.reload(); }, 5000);</script>';

                        } else {

                            html =
                                '<h2 style="color:green;">Deletion Completed Successfully</h2>';
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

                    log.debug('POST Params', {
                        fromDate: fromDate,
                        toDate: toDate
                    });

                    if (!fromDate || !toDate) {
                        throw new Error('Both dates are required');
                    }

                    var mrTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: 'customscript_vs_mr_delete_semnox_invoice',
                        deploymentId: 'customdeploy_vs_mr_delete_semnox_invoice',
                        params: {
                            custscript_vs_from_date_2: String(fromDate),
                            custscript_vs_to_date_2: String(toDate)
                        }
                    });

                    var taskId = mrTask.submit();

                    redirect.toSuitelet({
                        scriptId: runtime.getCurrentScript().id,
                        deploymentId: runtime.getCurrentScript().deploymentId,
                        parameters: {
                            custparam_taskid: taskId
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