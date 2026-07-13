/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Semnox Sales Report Download
 */

define(['N/ui/serverWidget', 'N/sftp', 'N/file', 'N/log'],
    function (serverWidget, sftp, file, log) {

        function onRequest(context) {
            try {

                log.debug('Suitelet', 'Start');

                if (context.request.method == 'GET') {

                    var form = serverWidget.createForm({
                        title: 'Download Malahi Report'
                    });

                    var dateField = form.addField({
                        id: 'custpage_date',
                        type: serverWidget.FieldType.DATE,
                        label: 'Date'
                    });

                    var typeField = form.addField({
                        id: 'custpage_report_type',
                        type: serverWidget.FieldType.SELECT,
                        label: 'Report Type'
                    });

                    typeField.addSelectOption({ value: '', text: 'Select Type' });
                    typeField.addSelectOption({ value: 'sales', text: 'Sales Report' });
                    typeField.addSelectOption({ value: 'games', text: 'Games Report' });

                    form.addSubmitButton({
                        label: 'Download'
                    });

                    context.response.writePage(form);

                } else {

                    var dateVal = context.request.parameters.custpage_date;
                    var reportType = context.request.parameters.custpage_report_type;

                    log.debug('POST Params', {
                        date: dateVal,
                        type: reportType
                    });

                    if (!dateVal || !reportType) {
                        throw new Error('Date and Report Type are required');
                    }

                    var formattedDate = formatDate(dateVal); // DDMMYY

                    var fileName = '';

                    if (reportType == 'sales') {
                        fileName = 'Malahi_Sales_Report_' + formattedDate + '.csv';
                    } else if (reportType == 'games') {
                        fileName = 'Malahi_Games_Report_' + formattedDate + '.csv';
                    } else {
                        throw new Error('Invalid report type');
                    }

                    log.debug('Generated File Name', fileName);

                    var connection = connectSftp();

                    var sftpFile = connection.download({
                        filename: fileName,
                        directory: '/netsuiteOracle'
                    });

                    if (!sftpFile) {
                        throw new Error('File not found on SFTP');
                    }

                    var csvFile = file.create({
                        name: fileName,
                        fileType: file.Type.CSV,
                        contents: sftpFile.getContents()
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

        function formatDate(dateStr) {
            try {

                // Expecting: DD/MM/YYYY
                var parts = dateStr.split('/');

                var day = parts[0];
                var month = parts[1];
                var year = parts[2].substring(2); // YY

                if (day.length == 1) day = '0' + day;
                if (month.length == 1) month = '0' + month;

                var result = day + month + year;

                log.debug('Formatted Date', result);

                return result;

            } catch (e) {
                log.error('formatDate Error', e);
                throw e;
            }
        }

        function connectSftp() {
            try {

                log.debug('SFTP', 'Connecting');

                var conn = sftp.createConnection({
                    url: 's-058b76ee20b54b28a.server.transfer.ap-southeast-1.amazonaws.com',
                    port: 22,
                    username: 'mudassir',
                    passwordGuid: 'custsecret_vs_semnox_password',
                    hostKey: 'AAAAB3NzaC1yc2EAAAADAQABAAACAQC1EXWmDzbwdW1UZC9I3sZhZsyQVQ6GQzNm4gIg7uDxbwfjGnEw8TjiHkJkfpX36PJ0pCVX7wW3ycI8z6LjPZ7ATUjiaMgxG6pamd4PZieBtQdzjr9UltnnhwY3fdUnWR+mBj57Lwr74WvXaGQPfuO0AdLy6MtVZP1QKwf9Va8Is97Ys9UdHrgcElOciHk3X5p6JPNp04c6pn8Lauf/T7qQ6uBZR0cN7q2hhlVLTCDZmzJwxZQm+PyJcKZT755SBZ4CaP/7iRR8qWuMu58DtFCqwxP9zboCEs7ECMPbA3fGKAgDkOVWD6EfUsB74YaKfX4Nra3+/Lye2cZzf75TEG59kjg8Ao8+FikYyx3CZEOY+A/8Y/1dUBIZXPoQUgVgw8HmaS6fzUyh8l7D8zkroxM3KeI8p+REZs8cLpy/hZY1w9kUUVlN2jMbWMODZg7ooS+FWoaURjZ34RYQvkXwDwgaXwtHKN+67NHjJqEIi5gbWbgwAI0Bt7VNkdTeBfONmk/tO+3CwZNAeI9v0x+OiT7bIvY7T4vLOaxPUKC+oJOwcEZxrfjDXoOIL6C1bcG1sFDuxtH3gHMqWpIg+Ejkl36+jNnQpWg+F2MLoMgtOtGR2NFFmFCh+X/dwvruuUVXP9OzoY9VNWbIRracMWrgOJA2d9MOfvobmdY2MwnBRLXZkQ==',
                    directory: '/malahi-semnox-sftp'
                });

                return conn;

            } catch (e) {
                log.error('SFTP Connection Error', e);
                throw e;
            }
        }

        return {
            onRequest: onRequest
        };
    });