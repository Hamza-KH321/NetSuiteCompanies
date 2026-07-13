/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/log', 'N/search', 'N/runtime', 'N/task'],
    function (record, log, search, runtime, task) {

        function getInputData() {
            try {
                var scriptObj = runtime.getCurrentScript();
                var csvData = scriptObj.getParameter({ name: 'custscript_vs_csv_data' });

                if (!csvData || csvData.trim() === '') {
                    throw new Error('CSV data is missing or empty.');
                }


                var searchResult = search.create({
                    type: 'customrecord_vs_itemminmaxquantity',
                    columns: ['internalid']
                });

                var deleteIds = [];
                searchResult.run().each(function (result) {
                    deleteIds.push(result.id);
                    return true;
                });

                log.audit('Records to Delete', 'Total: ' + deleteIds.length);

                return deleteIds;
            } catch (error) {
                log.error('ERROR in Get Input Stage', error);
            }
        }

        function map(context) {
            try {
                var recordId = context.value;
                if (recordId) {
                    record.delete({
                        type: 'customrecord_vs_itemminmaxquantity',
                        id: recordId
                    });
                    log.audit('Deleted Record', 'ID: ' + recordId);
                }
            } catch (error) {
                log.error('Error in Map Stage', error);
            }
        }

        function summarize(context) {

            var scriptObj = runtime.getCurrentScript();
            var csvData = scriptObj.getParameter({ name: 'custscript_vs_csv_data' });

            if (!csvData || csvData.trim() === '') {
                log.error('ERROR', 'CSV data is missing. The creation script will not be executed.');
                return;
            }

            try {
                var createTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: 'customscript_vs_mr_item_min_max_import',
                    deploymentId: 'customdeploy1',
                    params: { custscript_csv_data: csvData }
                });

                var taskId = createTask.submit();
                log.audit('Triggered Record Creation Script', 'Task ID: ' + taskId);

            } catch (error) {
                log.error('Error Triggering Creation Script', error);
            }
        }

        return {
            getInputData: getInputData,
            map: map,
            summarize: summarize
        };
    });
