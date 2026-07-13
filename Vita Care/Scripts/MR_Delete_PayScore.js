/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log', 'N/runtime', 'N/task'], function (search, record, log, runtime, task) {

    function getInputData() {
        try {
            var me = runtime.getCurrentScript();
            var fromDate = me.getParameter({ name: 'custscript_mr_delete_from_date' });
            var toDate = me.getParameter({ name: 'custscript_mr_delete_to_date' });

            log.debug('Parameters Filter', {
                fromDate: fromDate,
                toDate: toDate
            });

            var input = [];

            // First: Delete from customrecord_vs_pay_score_list
            var listSearch = search.create({
                type: "customrecord_vs_pay_score_list",
                filters: [],
                columns: ["internalid"]
            });

            listSearch.runPaged({ pageSize: 1000 }).pageRanges.forEach(function (pageRange) {
                var page = listSearch.runPaged({ pageSize: 1000 }).fetch({ index: pageRange.index });
                page.data.forEach(function (result) {
                    input.push({
                        recordType: 'customrecord_vs_pay_score_list',
                        id: result.getValue({ name: 'internalid' })
                    });
                });
            });

            // Second: Delete from customrecord_vs_pay_score
            var scoreSearch = search.create({
                type: "customrecord_vs_pay_score",
                filters: [],
                columns: ["internalid"]
            });

            scoreSearch.runPaged({ pageSize: 1000 }).pageRanges.forEach(function (pageRange) {
                var page = scoreSearch.runPaged({ pageSize: 1000 }).fetch({ index: pageRange.index });
                page.data.forEach(function (result) {
                    input.push({
                        recordType: 'customrecord_vs_pay_score',
                        id: result.getValue({ name: 'internalid' })
                    });
                });
            });

            return input;
        } catch (error) {
            log.error('GetInputData ERROR!!!', error);
        }
    }

    function map(context) {
        try {
            var data = JSON.parse(context.value);
            var recordType = data.recordType;
            var recordId = data.id;

            try {
                record.delete({
                    type: recordType,
                    id: recordId
                });
                context.write({ key: 'recordDeleted', value: recordType + ':' + recordId });
            } catch (error) {
                log.error({
                    title: 'Error Deleting Record',
                    details: 'Type: ' + recordType + ', ID: ' + recordId + ', Error: ' + error
                });
            }
        } catch (error) {
            log.error('MAP ERROR!!!', error);

        }
    }

    function summarize(summary) {
        try {
        // Trigger next Map/Reduce script
        var currentScript = runtime.getCurrentScript();
        var fromDate = currentScript.getParameter({ name: 'custscript_mr_delete_from_date' });
        var toDate = currentScript.getParameter({ name: 'custscript_mr_delete_to_date' });

        log.audit('Triggering Next Script', {
            scriptId: 'customscript_vs_mr_calculate_pay_score',
            fromDate: fromDate,
            toDate: toDate
        });

        var mrTask = task.create({
            taskType: task.TaskType.MAP_REDUCE,
            scriptId: 'customscript_vs_mr_calculate_pay_score',
            params: {
                custscript_mr_fromdate: fromDate,
                custscript_mr_todate: toDate
            }
        });

        var taskId = mrTask.submit();
        log.audit('Next Script Submitted', 'Task ID: ' + taskId);

        } catch (error) {
            log.error('summarize ERROR!!!', error);

        }
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
});
