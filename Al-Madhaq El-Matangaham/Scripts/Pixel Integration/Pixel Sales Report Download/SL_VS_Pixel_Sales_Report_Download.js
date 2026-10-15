/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Pixel Sales Report Download
 */

define(['N/ui/serverWidget', 'N/log'],
    function (serverWidget, log) {

        var API_BASE = 'https://eoi.wecreatives.agency/api/HQEOI/DownloadSalesReport';

        function onRequest(context) {
            try {

                log.debug('Suitelet', 'Start Pixel Report Download');

                if (context.request.method == 'GET') {

                    var form = serverWidget.createForm({
                        title: 'Download Pixel Sales Report'
                    });

                    form.addField({
                        id: 'custpage_from_date',
                        type: serverWidget.FieldType.DATE,
                        label: 'From Date'
                    });

                    form.addField({
                        id: 'custpage_to_date',
                        type: serverWidget.FieldType.DATE,
                        label: 'To Date'
                    });

                    form.addSubmitButton({
                        label: 'Download CSV'
                    });

                    context.response.writePage(form);

                } else {

                    var fromDate = context.request.parameters.custpage_from_date;
                    var toDate = context.request.parameters.custpage_to_date;

                    log.debug('POST Dates', 'From: ' + fromDate + ' | To: ' + toDate);

                    if (!fromDate || !toDate) {
                        throw new Error('Both From Date and To Date are required.');
                    }

                    var formattedFrom = convertDateFormat(fromDate);
                    var formattedTo = convertDateFormat(toDate);

                    log.debug('Formatted Dates', formattedFrom + ' - ' + formattedTo);

                    var apiUrl = API_BASE
                        + '?fromDate=' + encodeURIComponent(formattedFrom)
                        + '&toDate=' + encodeURIComponent(formattedTo);

                    log.debug('API URL', apiUrl);

                    // The CSV can exceed NetSuite's 10 MB in-memory limit, so the
                    // user's browser downloads it directly from the API instead of
                    // routing the data through this Suitelet.
                    var html =
                        '<!DOCTYPE html>' +
                        '<html><head><meta charset="utf-8"><title>Pixel Sales Report</title></head>' +
                        '<body style="font-family:Arial,Helvetica,sans-serif;padding:24px;">' +
                        '<h3>Pixel Sales Report</h3>' +
                        '<p>Period: ' + escapeHtml(formattedFrom) + ' to ' + escapeHtml(formattedTo) + '</p>' +
                        '<p>Your download should start automatically.</p>' +
                        '<p><a href="' + escapeHtml(apiUrl) + '">Click here if it does not start.</a></p>' +
                        '<p><a href="javascript:history.back()">&larr; Back</a></p>' +
                        '<script>' +
                        'window.location.href = ' + JSON.stringify(apiUrl).replace(/</g, '\\u003c') + ';' +
                        '</script>' +
                        '</body></html>';

                    context.response.write(html);
                }

            } catch (e) {
                log.error('Suitelet Error', e);
                context.response.write('Error: ' + e.message);
            }
        }

        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function convertDateFormat(dateStr) {

            try {

                var parts = dateStr.split('/');

                var day = parts[0];
                var monthNumber = parts[1];
                var yearFull = parts[2];

                var yearShort = yearFull.substring(yearFull.length - 2);

                var monthMap = {
                    '1': 'JAN', '01': 'JAN',
                    '2': 'FEB', '02': 'FEB',
                    '3': 'MAR', '03': 'MAR',
                    '4': 'APR', '04': 'APR',
                    '5': 'MAY', '05': 'MAY',
                    '6': 'JUN', '06': 'JUN',
                    '7': 'JUL', '07': 'JUL',
                    '8': 'AUG', '08': 'AUG',
                    '9': 'SEP', '09': 'SEP',
                    '10': 'OCT',
                    '11': 'NOV',
                    '12': 'DEC'
                };

                var monthText = monthMap[monthNumber];

                if (!monthText) {
                    throw new Error('Invalid month.');
                }

                return day + '-' + monthText + '-' + yearShort;

            } catch (e) {
                log.error('Date Conversion Error', e);
                throw e;
            }
        }

        return {
            onRequest: onRequest
        };
    });