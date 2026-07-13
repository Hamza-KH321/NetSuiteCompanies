/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/redirect', 'N/task'], function(serverWidget, redirect, task) {
    
    function onRequest(context) {
        if (context.request.method === 'GET') {
            // Create the form
            var form = serverWidget.createForm({
                title: 'Pay Score Calculator'
            });

            var dateFromField = form.addField({id: 'custpage_datefrom',type: serverWidget.FieldType.DATE,label: 'Date From'});
            var dateToField = form.addField({id: 'custpage_dateto',type: serverWidget.FieldType.DATE,label: 'Date To'});

            form.addSubmitButton({label: 'Calculate Pay Score'});

            context.response.writePage(form);
        } else {
            var dateFrom = context.request.parameters.custpage_datefrom;
            var dateTo = context.request.parameters.custpage_dateto;


            log.debug("Date From: ", dateFrom);
            log.debug("Date To: ", dateTo);

            var mapReduceTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: 'customscript_vs_mr_delete_pay_score_res',
                params: {
                    'custscript_mr_delete_from_date': dateFrom,
                    'custscript_mr_delete_to_date': dateTo
                }
            });

            var taskId = mapReduceTask.submit();
            context.response.write('Form Submitted Successfully! From Date: ' + dateFromField + ', To Date: ' + dateToField + '. Map/Reduce Task ID: ' + taskId);

        }
    }

    return {
        onRequest: onRequest
    };
});
