/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Pixel Error Log Cleanup
 */

define(['N/search', 'N/runtime', 'N/record', 'N/log'],
    function (search, runtime, record, log) {

        function getInputData() {

            try {

                var scriptObj = runtime.getCurrentScript();

                var fromDate = scriptObj.getParameter({ name: 'custscript_vs_from_date_delete' });
                var toDate = scriptObj.getParameter({ name: 'custscript_vs_to_date_delete' });

                log.debug('Parameters', fromDate + ' - ' + toDate);

                var startDateTime = fromDate + ' 12:00 am';
                var endDateTime = toDate + ' 11:00 pm';

                log.debug('Search Range', startDateTime + ' - ' + endDateTime);

                return search.create({
                    type: "customrecord_vs_pixel_integration_errors",
                    filters: [
                        ["custrecord_vs_date_time_created", "within",
                            startDateTime,
                            endDateTime
                        ]
                    ],
                    columns: [
                        search.createColumn({ name: "internalid" })
                    ]
                });

            } catch (e) {
                log.error('getInputData Error', e);
                throw e;
            }
        }

        function map(context) {

            try {

                var result = JSON.parse(context.value);
                var recId = result.id;

                context.write({
                    key: recId,
                    value: recId
                });

            } catch (e) {
                log.error('Map Error', e);
            }
        }

        function reduce(context) {

            try {

                var recId = context.key;

                record.delete({
                    type: "customrecord_vs_pixel_integration_errors",
                    id: recId
                });

                log.debug('Deleted Error Log ID', recId);

            } catch (e) {
                log.error('Reduce Error ID ' + context.key, e);
            }
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce
        };
    });