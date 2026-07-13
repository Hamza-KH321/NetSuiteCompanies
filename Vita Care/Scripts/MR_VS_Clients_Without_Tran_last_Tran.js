/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/log', 'N/record'],
    function (search, log, record) {

        function getInputData() {
            var customrecord_vs_clientnotranSearchObj = search.create({
                type: "customrecord_vs_clientnotran",
                filters: [],
                columns: [
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "custrecord_vs_client_nt", label: "Client NT" })
                ]
            });

            return customrecord_vs_clientnotranSearchObj;
        }

        function map(context) {
            try {
                var result = JSON.parse(context.value);
                var clientId = result.values.custrecord_vs_client_nt.value;
                var recordId = result.id;

                var transactionSearchObj = search.create({
                    type: "transaction",
                    settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                    filters: [
                        ["type", "anyof", "CustInvc", "CustPymt"],
                        "AND",
                        ["mainline", "is", "T"],
                        "AND",
                        ["customer.internalid", "anyof", clientId]
                    ],
                    columns: [
                        search.createColumn({ name: "internalid", label: "Internal ID" }),
                        search.createColumn({ name: "tranid", label: "Document Number" }),
                        search.createColumn({ name: "trandate", label: "Date", sort: search.Sort.DESC })
                    ]
                });

                var transactionResult = transactionSearchObj.run().getRange({ start: 0, end: 1 });
                if (transactionResult.length > 0) {
                    var lastTransactionId = transactionResult[0].getValue("internalid");
                    var lastTransactionDate = transactionResult[0].getValue("trandate");

                    record.submitFields({
                        type: "customrecord_vs_clientnotran",
                        id: recordId,
                        values: {
                            custrecord_vs_lasttransactiondate: lastTransactionDate,
                            custrecord_vs_last_transaction: lastTransactionId
                        }
                    });

                    log.debug("Updated Record", "Customer ID: " + clientId + " | Last Transaction ID: " + lastTransactionId);
                }
            } catch (e) {
                log.error("Map Error", e);
            }
        }


        function reduce(context) {
            // Not needed for this script
        }

        function summarize(summary) {
            log.audit("Script Completed", "Processed " + summary.inputSummary.recordCount + " records");
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
    });
