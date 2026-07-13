/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/task'], function (serverWidget, task) {
    function onRequest(context) {
        if (context.request.method === 'GET') {
            var form = serverWidget.createForm({ title: 'Vacation Calculator' });

            form.addField({ id: 'custpage_from_date', type: serverWidget.FieldType.DATE, label: 'From Date' });
            form.addField({ id: 'custpage_to_date', type: serverWidget.FieldType.DATE, label: 'To Date' });
            form.addSubmitButton({ label: 'Calculate' });

            context.response.writePage(form);
        } else {
            var fromDate = context.request.parameters.custpage_from_date;
            var toDate = context.request.parameters.custpage_to_date;

            var mrTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: 'customscript_vs_mr_calculate_vacation',
                deploymentId: 'customdeploy1',
                params: {
                    custscript_from_date: fromDate,
                    custscript_to_date: toDate
                }
            });

            var taskId = mrTask.submit();

            context.response.write({
                output: 'Map/Reduce task submitted successfully with ID: ' + taskId
            });
        }
    }

    return {
        onRequest: onRequest
    };
});