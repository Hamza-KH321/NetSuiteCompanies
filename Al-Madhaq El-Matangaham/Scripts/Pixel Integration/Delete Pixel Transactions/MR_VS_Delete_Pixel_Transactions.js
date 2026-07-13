/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Delete Pixel Transactions
 */

define(['N/search', 'N/runtime', 'N/record', 'N/log'],
    function (search, runtime, record, log) {

        function getInputData() {
            try {

                log.debug('MR', 'Start getInputData');

                var scriptObj = runtime.getCurrentScript();

                var fromDate = scriptObj.getParameter({
                    name: 'custscript_vs_from_date'
                });

                var toDate = scriptObj.getParameter({
                    name: 'custscript_vs_to_date'
                });

                log.debug('Parameters', 'From: ' + fromDate + ' | To: ' + toDate);

                var salesorderSearchObj = search.create({
                    type: "salesorder",
                    settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                    filters:
                        [
                            ["mainline", "is", "T"],
                            "AND",
                            ["type", "anyof", "SalesOrd"],
                            "AND",
                            ["custbody_vs_pixel_transaction", "is", "T"],
                            "AND",
                            ["trandate", "within", fromDate, toDate],
                            "AND",
                            ["internalid", "anyof", "2706"]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "tranid", label: "Document Number" }),
                            search.createColumn({ name: "internalid", label: "Internal ID" })
                        ]
                });

                return salesorderSearchObj;

            } catch (e) {
                log.error('getInputData Error', e);
            }
        }

        function map(context) {
            try {

                var result = JSON.parse(context.value);

                var soId = result.id;

                log.debug('Map', 'Processing SO ID: ' + soId);

                context.write({
                    key: soId,
                    value: soId
                });

            } catch (e) {
                log.error('Map Error', e);
            }
        }

        function reduce(context) {
            try {

                var soId = context.key;

                log.debug('Reduce', 'Deleting SO ID: ' + soId);

                record.delete({
                    type: record.Type.SALES_ORDER,
                    id: soId
                });

                log.debug('Deleted', 'SO ID: ' + soId);

            } catch (e) {
                log.error('Reduce Error SO ID ' + context.key, e);
            }
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce
        };
    });
    