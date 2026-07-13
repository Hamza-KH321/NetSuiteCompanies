/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || WMS Status Sync
 */
define(['N/search', 'N/https', 'N/record', 'N/log', 'N/runtime'],
    function (search, https, record, log, runtime) {

        function getInputData() {
            try {

                log.debug('getInputData', 'Starting Search');

                var scriptObj = runtime.getCurrentScript();

                var fromDate = scriptObj.getParameter({
                    name: 'custscript_vs_wms_from_date'
                });

                var toDate = scriptObj.getParameter({
                    name: 'custscript_vs_wms_to_date'
                });

                log.debug('Raw From Date', fromDate);
                log.debug('Raw To Date', toDate);

                fromDate = formatDate(fromDate);
                toDate = formatDate(toDate);

                log.debug('Formatted From Date', fromDate);
                log.debug('Formatted To Date', toDate);

                var filters = [
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['custbody_vs_so_integration_status', 'contains', 'Sent'],
                    'AND',
                    ['custbody_vs_allocation_done', 'is', 'T'],
                    'AND',
                    ['status', 'anyof', 'SalesOrd:B'],
                    'AND',
                    ['trandate', 'onorafter', fromDate],
                    'AND',
                    ['trandate', 'onorbefore', toDate],
                    'AND',
                    [
                        ['custbody_vs_wms_status', 'isempty', ''],
                        'OR',
                        ['custbody_vs_wms_status', 'doesnotcontain', 'Created']
                    ],
                    // 'AND',
                    // ['internalid', 'anyof', 6085854]
                ];

                var salesOrderSearch = search.create({
                    type: 'salesorder',
                    filters: filters,
                    columns: [
                        search.createColumn({
                            name: 'internalid'
                        }),
                        search.createColumn({
                            name: 'tranid'
                        })
                    ]
                });

                var previewResults = salesOrderSearch.run().getRange({
                    start: 0,
                    end: 1000
                });

                log.debug('Search Result Count', previewResults.length);

                previewResults.forEach(function (result, index) {

                    log.debug('Search Result ' + index, {
                        internalid: result.getValue({
                            name: 'internalid'
                        }),
                        tranid: result.getValue({
                            name: 'tranid'
                        })
                    });
                });

                return salesOrderSearch;

            } catch (e) {

                log.error('getInputData Error', e);
            }
        }

        function map(context) {
            try {

                var searchResult = JSON.parse(context.value);

                var salesOrderId = searchResult.id;
                var salesOrderNumber = searchResult.values.tranid;

                log.debug('Processing SO', {
                    salesOrderId: salesOrderId,
                    salesOrderNumber: salesOrderNumber
                });

                var remainingUsage = runtime.getCurrentScript().getRemainingUsage();

                log.debug('Remaining Usage', remainingUsage);

                var apiUrl =
                    'https://vitacare-wms-service-prod-181839338436.us-central1.run.app/sales-order/status?orderNumber=' +
                    salesOrderNumber;

                var wmsStatus = '';
                var syncError = '';

                try {

                    var response = https.get({
                        url: apiUrl,
                        headers: {
                            'Accept': '*/*',
                            'Content-Type': 'application/json',
                            'Authorization': 'Basic Vml0YWNhcmVBZG1pbjoxMjM0NTY3OA=='
                        }
                    });

                    log.debug('API Response Code', response.code);

                    if (response.code == 200 && response.body) {

                        wmsStatus = response.body.trim();

                        log.debug('WMS Status', wmsStatus);

                        if (wmsStatus == 'Created') {

                            log.debug(
                                'Skipping Update Because WMS Status Is Created',
                                salesOrderNumber
                            );

                            return;
                        }

                    } else {

                        syncError = 'Invalid Response Code: ' + response.code;

                        log.error('Invalid API Response', syncError);
                    }

                } catch (apiErr) {

                    syncError = apiErr.message || apiErr;

                    log.error('API Error', apiErr);
                }

                try {

                    var valuesToUpdate = {
                        custbody_vs_wms_last_sync: new Date()
                    };

                    if (wmsStatus) {
                        valuesToUpdate.custbody_vs_wms_status = wmsStatus;
                    }

                    if (syncError) {
                        valuesToUpdate.custbody_vs_wms_sync_error = syncError;
                    } else {
                        valuesToUpdate.custbody_vs_wms_sync_error = '';
                    }

                    record.submitFields({
                        type: record.Type.SALES_ORDER,
                        id: salesOrderId,
                        values: valuesToUpdate,
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        }
                    });

                    log.debug('SO Updated Successfully', salesOrderNumber);

                } catch (updateErr) {

                    log.error('Update Error', updateErr);
                }

            } catch (e) {

                log.error('Map Error', e);
            }
        }

        function formatDate(dateString) {
            try {

                var dateObj = new Date(dateString);

                var day = dateObj.getDate();
                var month = dateObj.getMonth() + 1;
                var year = dateObj.getFullYear();

                if (day < 10) {
                    day = '0' + day;
                }

                if (month < 10) {
                    month = '0' + month;
                }

                return day + '/' + month + '/' + year;

            } catch (e) {

                log.error('formatDate Error', e);

                return '';
            }
        }

        return {
            getInputData: getInputData,
            map: map
        };
    });