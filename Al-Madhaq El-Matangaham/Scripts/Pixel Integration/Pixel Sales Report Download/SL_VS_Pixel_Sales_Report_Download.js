/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Pixel Sales Report Download
 */

define(['N/ui/serverWidget', 'N/https', 'N/log', 'N/file'],
    function (serverWidget, https, log, file) {

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

                    var apiUrl =
                        'https://eoi.wecreatives.agency/api/HQEOI/DownloadSalesReport?fromDate='
                        + formattedFrom +
                        '&toDate=' +
                        formattedTo;

                    log.debug('API URL', apiUrl);

                    var response = https.get({
                        url: apiUrl
                    });

                    if (response.code < 200 || response.code >= 300) {
                        throw new Error('API Call Failed. HTTP Code: ' + response.code);
                    }

                    var csvContent = response.body || '';

                    log.debug('CSV Length', csvContent.length);

                    var fileName =
                        'Pixel_Sales_Report_' +
                        formattedFrom +
                        '_to_' +
                        formattedTo +
                        '.csv';

                    var csvFile = file.create({
                        name: fileName,
                        fileType: file.Type.CSV,
                        contents: csvContent
                    });

                    context.response.writeFile({
                        file: csvFile,
                        isInline: false
                    });
                }

            } catch (e) {
                log.error('Suitelet Error', e);
                context.response.write('Error: ' + e.message);
            }
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