/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Delete Semnox Invoices
 */

define(['N/search', 'N/record', 'N/runtime', 'N/log'],
    function (search, record, runtime, log) {

        function getInputData() {
            try {

                log.debug('getInputData', 'Start');

                var script = runtime.getCurrentScript();

                var fromDate = script.getParameter({ name: 'custscript_vs_from_date_2' });
                var toDate = script.getParameter({ name: 'custscript_vs_to_date_2' });

                log.debug('Params', {
                    fromDate: fromDate,
                    toDate: toDate
                });

                if (!fromDate || !toDate) {
                    throw new Error('Missing parameters');
                }

                var searchObj = search.create({
                    type: "invoice",
                    settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
                    filters: [
                        ["type", "anyof", "CustInvc"],
                        "AND",
                        ["mainline", "is", "T"],
                        "AND",
                        ["trandate", "within", fromDate, toDate],
                        "AND",
                        ["custbody_vs_semnox_transaction", "is", "T"]
                    ],
                    columns: ["internalid"]
                });

                var count = searchObj.runPaged().count;
                log.debug('TOTAL FOUND', count);

                return searchObj;

            } catch (e) {
                log.error('getInputData Error', e);
                return [];
            }
        }

        function map(context) {
            try {

                var result = JSON.parse(context.value);
                var id = result.id;

                log.debug('DELETE_INVOICE', id);

                record.delete({
                    type: record.Type.INVOICE,
                    id: id
                });

                log.audit('DELETED', id);

            } catch (e) {
                log.error('MAP ERROR', e);
            }
        }

        return {
            getInputData: getInputData,
            map: map
        };
    });