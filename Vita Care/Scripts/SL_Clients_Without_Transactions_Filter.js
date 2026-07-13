/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/log', 'N/task'],
    function(serverWidget, log, task) {
        function onRequest(context) {
            if (context.request.method === 'GET') {
                // Create the form
                var form = serverWidget.createForm({
                    title: 'Clients Without Transactions'
                });

                // Add 'From Date' field
                var fromDateField = form.addField({
                    id: 'custpage_fromdate',
                    type: serverWidget.FieldType.DATE,
                    label: 'From Date'
                });

                // Add 'To Date' field
                var toDateField = form.addField({
                    id: 'custpage_todate',
                    type: serverWidget.FieldType.DATE,
                    label: 'To Date'
                });

                // Add Submit button
                form.addSubmitButton({
                    label: 'Submit'
                });

                // Display the form
                context.response.writePage(form);

            } else { // POST request handling
                var fromDate = context.request.parameters.custpage_fromdate;
                var toDate = context.request.parameters.custpage_todate;

                // Log the received dates
                log.debug('Selected Dates', 'From Date: ' + fromDate + ', To Date: ' + toDate);

                // Create and submit the Map/Reduce script task
                var mapReduceTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: 'customscript_vs_mr_clientswithouttran', // Replace with your Map/Reduce script ID
                    params: {
                        'custscript_mr_fromdate_client': fromDate, // Replace with your parameter ID
                        'custscript_mr_todate_client': toDate // Replace with your parameter ID
                    }
                });

                var taskId = mapReduceTask.submit();

                // Display a confirmation message
                context.response.write('Form Submitted Successfully! From Date: ' + fromDate + ', To Date: ' + toDate + '. Map/Reduce Task ID: ' + taskId);
            }
        }

        return {
            onRequest: onRequest
        };
    });
