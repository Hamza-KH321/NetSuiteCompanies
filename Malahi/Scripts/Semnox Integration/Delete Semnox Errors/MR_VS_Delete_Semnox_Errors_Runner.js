/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Delete Semnox Errors Runner
 */

define(['N/search', 'N/record', 'N/runtime', 'N/log'],
    function (search, record, runtime, log) {

        function getInputData() {
            try {

                log.debug('getInputData', 'Start');

                var script = runtime.getCurrentScript();

                var fromDate = script.getParameter({ name: 'custscript_vs_from_date' });
                var toDate = script.getParameter({ name: 'custscript_vs_to_date' });

                log.debug('RAW PARAMS', {
                    fromDate: fromDate,
                    toDate: toDate
                });

                if (!fromDate || !toDate) {
                    throw new Error('Missing parameters');
                }

                // ✅ DO NOT CONVERT
                var fromDateTime = fromDate + ' 12:00 am';
                var toDateTime = toDate + ' 11:59 pm';

                log.debug('FINAL FILTER', {
                    from: fromDateTime,
                    to: toDateTime
                });

                var searchObj = search.create({
                    type: 'customrecord_vs_semnox_errors',
                    filters: [
                        ['custrecord_vs_date_time_created', 'onorafter', fromDateTime],
                        'AND',
                        ['custrecord_vs_date_time_created', 'onorbefore', toDateTime]
                    ],
                    columns: ['internalid']
                });

                var count = searchObj.runPaged().count;
                log.debug('RESULT COUNT', count);

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

                record.delete({ type: 'customrecord_vs_semnox_errors', id: id });

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