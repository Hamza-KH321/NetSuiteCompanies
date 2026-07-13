/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Pixel SO Integration Runner
 */

define(['N/ui/serverWidget', 'N/task', 'N/log', 'N/redirect', 'N/runtime'],
    function (serverWidget, task, log, redirect, runtime) {

        function onRequest(context) {
            try {

                log.debug('Suitelet', 'Start Pixel Integration Suitelet');

                var taskId = context.request.parameters.custparam_taskid;

                if (context.request.method == 'GET') {

                    var form = serverWidget.createForm({
                        title: 'Pixel SO Integration'
                    });

                    var fromField = form.addField({
                        id: 'custpage_from_date',
                        type: serverWidget.FieldType.DATE,
                        label: 'From Date'
                    });

                    var toField = form.addField({
                        id: 'custpage_to_date',
                        type: serverWidget.FieldType.DATE,
                        label: 'To Date'
                    });

                    form.addFieldGroup({
                        id: 'custpage_task_status',
                        label: 'Task Status'
                    });

                    form.addSubmitButton({
                        label: 'Run Integration'
                    });

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
                                '<div style="color:red"><h2>Processing. Please wait...</h2></div>' +
                                '<div><b>Percentage Completed:</b> ' + percentage + '%</div>' +
                                '<div><b>Current Stage:</b> ' + stage + '</div>' +
                                '</div>' +
                                '<script>setTimeout(function(){ location.reload(); }, 10000);</script>';

                        } else {

                            statusHtml =
                                '<h2 style="color:green;">Integration Completed Successfully</h2>';
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

                    log.debug('POST Values', 'From: ' + fromDate + ' | To: ' + toDate);

                    var formattedFrom = convertDateFormat(fromDate);
                    var formattedTo = convertDateFormat(toDate);

                    log.debug('Formatted Dates', 'From: ' + formattedFrom + ' | To: ' + formattedTo);

                    var apiUrl =
                        'https://eoi.wecreatives.agency/api/HQEOI/DownloadSalesReport?fromDate='
                        + formattedFrom +
                        '&toDate=' +
                        formattedTo;

                    log.debug('Final API URL', apiUrl);

                    var mrTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: 'customscript_vs_mr_pixel_so_integration',
                        deploymentId: 'customdeploy_vs_mr_pixel_so_integration',
                        params: {
                            custscript_vs_pixel_api_url: apiUrl
                        }
                    });

                    var newTaskId = mrTask.submit();

                    log.debug('MR Submitted', 'Task ID: ' + newTaskId);

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

        function convertDateFormat(dateStr) {
            try {

                if (!dateStr) {
                    throw new Error('Invalid Date');
                }

                var parts = dateStr.split('/');

                var day = parts[0];
                var monthNumber = parts[1];
                var yearFull = parts[2];

                var yearShort = yearFull.substring(yearFull.length - 2);

                var monthMap = {
                    '1': 'JAN', '01': 'JAN',
                    '2': 'FEB', '02': 'FEB',
                    '3': 'MAR', '03': 'MAR',
                    '4': 'APR', '04': 'APR',
                    '5': 'MAY', '05': 'MAY',
                    '6': 'JUN', '06': 'JUN',
                    '7': 'JUL', '07': 'JUL',
                    '8': 'AUG', '08': 'AUG',
                    '9': 'SEP', '09': 'SEP',
                    '10': 'OCT',
                    '11': 'NOV',
                    '12': 'DEC'
                };

                var monthText = monthMap[monthNumber];

                if (!monthText) {
                    throw new Error('Invalid month');
                }

                return day + '-' + monthText + '-' + yearShort;

            } catch (e) {
                log.error('Date Conversion Error', e);
                throw e;
            }
        }

        return {
            onRequest: onRequest
        };
    });