/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/log', 'N/record', 'N/runtime', 'N/task'],
    function (search, log, record, runtime, task) {

        function beforeMap() {
            // Delete existing records before starting the map phase
            try {
                var existingRecordsSearch = search.create({
                    type: "customrecord_vs_clientnotran",
                    columns: ['internalid']
                });

                var pagedData = existingRecordsSearch.runPaged({ pageSize: 1000 });

                pagedData.pageRanges.forEach(function (pageRange) {
                    var page = pagedData.fetch({ index: pageRange.index });
                    page.data.forEach(function (result) {
                        var recordId = result.getValue('internalid');
                        try {
                            record.delete({
                                type: 'customrecord_vs_clientnotran', // Your custom record type
                                id: recordId
                            });
                            log.debug('Record Deleted', 'Record ID: ' + recordId);
                        } catch (deleteError) {
                            log.error('Error Deleting Record', 'Record ID: ' + recordId + ' - ' + deleteError.message);
                        }
                    });
                });
            } catch (e) {
                log.error('Search Error', e.message);
            }
        }

        function getInputData() {

            // var fromDate = context.request.custscript_mr_fromdate_client;
            // var toDate = context.request.custscript_mr_todate_client;

            var me = runtime.getCurrentScript();
            var fromDate = me.getParameter({ name: 'custscript_mr_fromdate_client' });
            var toDate = me.getParameter({ name: 'custscript_mr_todate_client' });

            log.audit('From Date:' + fromDate + ' Todate ' + toDate);
            var customerSearchObj = search.create({
                type: "customer",
                filters: [
                    ["isinactive", "is", "F"]
                ],
                columns: [
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "entityid", label: "ID" }),
                    search.createColumn({ name: "altname", label: "Name" })
                ]
            });

            var allResults = [];
            var pagedData = customerSearchObj.runPaged({ pageSize: 1000 });

            pagedData.pageRanges.forEach(function (pageRange) {
                var page = pagedData.fetch({ index: pageRange.index });
                page.data.forEach(function (result) {
                    allResults.push({
                        id: result.id,
                        internalid: result.getValue('internalid'),
                        entityid: result.getValue('entityid'),
                        altname: result.getValue('altname')
                    });
                });
            });
            beforeMap();
            return allResults;
        }

        function map(context) {
            try {
                var customer = JSON.parse(context.value);
                // log.debug('Map Stage', 'Processing Customer ID: ' + customer.internalid);

                var me = runtime.getCurrentScript();
                var fromDate = me.getParameter({ name: 'custscript_mr_fromdate_client' });
                var toDate = me.getParameter({ name: 'custscript_mr_todate_client' });

                // log.debug('Processing Transactions', 'From Date: ' + fromDate + ', To Date: ' + toDate);

                var transactionSearchObj = search.create({
                    type: "transaction",
                    settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                    filters: [
                        ["type", "anyof", "CustInvc", "CustPymt"],
                        "AND",
                        ["customer.entityid", "is", customer.entityid],
                        "AND",
                        ["trandate", "within", fromDate, toDate],
                        "AND",
                        ["accounttype", "anyof", "AcctRec"]
                    ],
                    columns: [
                        search.createColumn({
                            name: "entityid",
                            join: "customer",
                            summary: "GROUP",
                            label: "ID"
                        }),
                        search.createColumn({
                            name: "internalid",
                            summary: "COUNT",
                            label: "Count"
                        }),
                        search.createColumn({
                            name: "amount",
                            summary: "SUM",
                            label: "Amount"
                        })
                    ]
                });

                var searchResult = transactionSearchObj.run().getRange({ start: 0, end: 1 }); // Only need the first result
                var resultCount = 0;
                var amount = 0;

                // log.debug('Transaction Search Result: ',searchResult);

                //     var pagedData = transactionSearchObj.runPaged({ pageSize: 1000 });
                // pagedData.pageRanges.forEach(function (pageRange) {
                //     var page = pagedData.fetch({ index: pageRange.index });
                //     page.data.forEach(function (result) {
                //         resultCount += parseInt(result.getValue({ name: "internalid", summary: "COUNT" }), 10);
                //     });
                // });
                if (searchResult && searchResult.length > 0) {
                    // Get the count and amount from the search result
                    resultCount = searchResult[0].getValue({ name: "internalid", summary: "COUNT" });
                    amount = parseFloat(searchResult[0].getValue({ name: "amount", summary: "SUM" })) || 0;
                    // log.debug('Result Count:' + resultCount, 'amount:' + amount);
                }
                // log.debug('Transaction Result Count', 'Count: ' + resultCount + ' for Customer ID: ' + customer.internalid);


                var balanceSearchObj = search.create({
                    type: "transaction",
                    settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                    filters: [
                        ["accounttype", "anyof", "AcctRec"],
                        "AND",
                        ["customer.entityid", "is", customer.entityid],
                        "AND",
                        ["trandate", "before", fromDate]
                    ],
                    columns: [
                        search.createColumn({
                            name: "amount",
                            summary: "SUM",
                            label: "Balance Amount"
                        })
                    ]
                });

                var balanceResult = balanceSearchObj.run().getRange({ start: 0, end: 1 });
                var balanceAmount = 0;

                if (balanceResult && balanceResult.length > 0) {
                    balanceAmount = parseFloat(balanceResult[0].getValue({ name: "amount", summary: "SUM" })) || 0;
                }

                // log.debug('Customer Balance', 'Balance: ' + balanceAmount + ' for Customer ID: ' + customer.internalid);
                if (resultCount === 0) {
                    try {
                        var newRecord = record.create({ type: 'customrecord_vs_clientnotran' });

                        newRecord.setValue({ fieldId: 'custrecord_vs_client_nt', value: customer.internalid });
                        newRecord.setValue({ fieldId: 'custrecord_vs_client_balance', value: balanceAmount });

                        var recordId = newRecord.save();
                        log.debug('Record Created', 'Record ID: ' + recordId + ' for Customer ID: ' + customer.internalid);
                    } catch (e) {
                        log.error('Record Creation Error', e.name + ': ' + e.message);
                    }
                }
            } catch (error) {
                log.error('MAP Error', error);
            }
        }

        function summarize(summary) {
            log.audit("First Map/Reduce Completed", "Executing the second Map/Reduce script");

            try {
                var mrTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: 'customscript_vs_mr_client_last_transa', // Replace with actual script ID
                    deploymentId: 'customdeploy1' // Replace with actual deployment ID
                });

                var taskId = mrTask.submit();
                log.audit("Triggered Second Map/Reduce", "Task ID: " + taskId);
            } catch (e) {
                log.error("Error Triggering Second Script", e.message);
            }
        }


        return {
            getInputData: getInputData,
            map: map,
            summarize: summarize
        };
    });
