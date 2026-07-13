/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Semnox Integration Games
 */

define(['N/sftp', 'N/file', 'N/record', 'N/search', 'N/log', 'N/runtime'],
    function (sftp, file, record, search, log, runtime) {

        const SFTP_DIR = '/malahi-semnox-sftp';
        const CUSTOM_FORM_ID = 115;
        const ARCHIVE_FOLDER_ID = 184;

        const ERROR_REC_TYPE = 'customrecord_vs_semnox_errors';
        const ERR_DATE_FIELD = 'custrecord_vs_date_time_created';
        const ERR_MSG_FIELD = 'custrecord_vs_error';

        var LOCATION_MAP = {};
        var CUSTOMER_MAP = {};
        var ITEM_MAP = {};
        var FILE_ARCHIVED = false;

        function normalize(val) {
            return (val || '').toString().replace(/"/g, '').trim().toLowerCase();
        }

        /* ================= GET INPUT ================= */
        function getInputData() {
            try {

                log.debug('getInputData', 'Start');

                loadLocations();
                loadCustomers();
                loadItems();

                var filename = getYesterdayFilename();

                log.debug('Target File', filename);

                return [{ name: filename }];

            } catch (e) {
                log.error('getInputData error', e);
                logError('getInputData: ' + e.message);
                return [];
            }
        }

        /* ================= MAP ================= */
        function map(context) {
            try {

                var obj = JSON.parse(context.value);
                var filename = obj.name;

                var conn = connectSftp();
                if (!conn) return;

                var fileObj = conn.download({
                    filename: filename,
                    directory: '/netsuiteOracle'
                });

                var rows = parseCsv(fileObj.getContents());
                if (!rows.length) return;

                var isGames = filename.indexOf('Games') != -1;

                var groups = {};

                rows.forEach(function (r) {

                    var site = isGames ? r.Location : r.Site_Name;

                    var payment = isGames
                        ? (r['Payment Method'] || 'No Payment')
                        : (r.Payment_Method || 'No Payment');

                    var product = isGames
                        ? r['Game Name']
                        : r.Product_Name;

                    var amount = isGames
                        ? r['Total Play(Amount)']
                        : r.Taxable_Net_Amount;

                    var trxdate = isGames
                        ? r.Date
                        : r.Trxdate;

                    var key = normalize(site) + '||' + normalize(payment);

                    if (!groups[key]) groups[key] = [];

                    groups[key].push({
                        site: site,
                        payment: payment,
                        product: product,
                        amount: amount,
                        trxdate: trxdate
                    });
                });

                for (var k in groups) {
                    context.write(k, JSON.stringify({
                        filename: filename,
                        rows: groups[k]
                    }));
                }

            } catch (e) {
                logError('map: ' + e.message);
            }
        }

        /* ================= REDUCE ================= */
        function reduce(context) {
            try {

                log.debug('REDUCE_START', {
                    key: context.key,
                    valuesCount: context.values.length
                });

                if (!Object.keys(CUSTOMER_MAP).length) loadCustomers();
                if (!Object.keys(LOCATION_MAP).length) loadLocations();
                if (!Object.keys(ITEM_MAP).length) loadItems();

                var payload = JSON.parse(context.values[0]);
                var rows = payload.rows;
                var filename = payload.filename;

                var parts = context.key.split('||');
                var siteName = parts[0];
                var paymentMethod = parts[1];

                var customerId = CUSTOMER_MAP[paymentMethod];
                if (!customerId) {
                    throw new Error('Customer not found for payment method: ' + paymentMethod);
                }

                var locationId = LOCATION_MAP[siteName];
                if (!locationId) {
                    throw new Error('Location not found for site: ' + siteName);
                }

                var invoice = record.create({
                    type: record.Type.INVOICE,
                    isDynamic: true
                });

                invoice.setValue({ fieldId: 'entity', value: customerId });
                invoice.setValue({ fieldId: 'customform', value: CUSTOM_FORM_ID });
                invoice.setValue({ fieldId: 'location', value: locationId });
                invoice.setValue({ fieldId: 'trandate', value: toNsDate(rows[0].trxdate) });
                invoice.setValue({ fieldId: 'approvalstatus', value: 2 });
                invoice.setValue({ fieldId: 'custbody_vs_semnox_transaction', value: true });
                invoice.setValue({ fieldId: 'custbodyvs_system', value: 1 });

                rows.forEach(function (r) {

                    var itemKey = normalize(r.product);
                    var itemId = ITEM_MAP[itemKey];

                    if (!itemId) {
                        throw new Error('Item not found: ' + r.product);
                    }

                    invoice.selectNewLine({ sublistId: 'item' });

                    invoice.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: itemId
                    });

                    invoice.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: r.amount
                    });

                    invoice.commitLine({ sublistId: 'item' });
                });

                var invoiceId = invoice.save();

                log.audit('INVOICE_CREATED', {
                    invoiceId: invoiceId,
                    filename: filename
                });

                if (!FILE_ARCHIVED) {
                    archiveFile(filename);
                    FILE_ARCHIVED = true;
                }

            } catch (e) {

                log.error('REDUCE_ERROR', {
                    key: context.key,
                    error: e.message
                });

                logError('reduce: ' + e.message);
            }
        }

        /* ================= HELPERS ================= */

        function getYesterdayFilename() {
            return 'Malahi_Games_Report_170426.csv';
        }

        function formatDate(dateStr) {
            var p = dateStr.split('/');
            var d = p[0].length == 1 ? '0' + p[0] : p[0];
            var m = p[1].length == 1 ? '0' + p[1] : p[1];
            var y = p[2].substring(2);
            return d + m + y;
        }

        function toNsDate(str) {
            var p = str.split('/');
            return new Date(p[2], p[1] - 1, p[0]);
        }

        function connectSftp() {
            return sftp.createConnection({
                url: 's-058b76ee20b54b28a.server.transfer.ap-southeast-1.amazonaws.com',
                port: 22,
                username: 'mudassir',
                passwordGuid: 'custsecret_vs_semnox_password',
                hostKey: 'AAAAB3NzaC1yc2EAAAADAQABAAACAQC1EXWmDzbwdW1UZC9I3sZhZsyQVQ6GQzNm4gIg7uDxbwfjGnEw8TjiHkJkfpX36PJ0pCVX7wW3ycI8z6LjPZ7ATUjiaMgxG6pamd4PZieBtQdzjr9UltnnhwY3fdUnWR+mBj57Lwr74WvXaGQPfuO0AdLy6MtVZP1QKwf9Va8Is97Ys9UdHrgcElOciHk3X5p6JPNp04c6pn8Lauf/T7qQ6uBZR0cN7q2hhlVLTCDZmzJwxZQm+PyJcKZT755SBZ4CaP/7iRR8qWuMu58DtFCqwxP9zboCEs7ECMPbA3fGKAgDkOVWD6EfUsB74YaKfX4Nra3+/Lye2cZzf75TEG59kjg8Ao8+FikYyx3CZEOY+A/8Y/1dUBIZXPoQUgVgw8HmaS6fzUyh8l7D8zkroxM3KeI8p+REZs8cLpy/hZY1w9kUUVlN2jMbWMODZg7ooS+FWoaURjZ34RYQvkXwDwgaXwtHKN+67NHjJqEIi5gbWbgwAI0Bt7VNkdTeBfONmk/tO+3CwZNAeI9v0x+OiT7bIvY7T4vLOaxPUKC+oJOwcEZxrfjDXoOIL6C1bcG1sFDuxtH3gHMqWpIg+Ejkl36+jNnQpWg+F2MLoMgtOtGR2NFFmFCh+X/dwvruuUVXP9OzoY9VNWbIRracMWrgOJA2d9MOfvobmdY2MwnBRLXZkQ==',
                directory: SFTP_DIR
            });
        }

        function archiveFile(filename) {
            try {

                var conn = connectSftp();

                var sftpFile = conn.download({
                    filename: filename,
                    directory: '/netsuiteOracle'
                });

                var archivedFile = file.create({
                    name: filename,
                    fileType: file.Type.CSV,
                    contents: sftpFile.getContents(),
                    folder: ARCHIVE_FOLDER_ID
                });

                archivedFile.save();

            } catch (e) {
                log.error('ARCHIVE_ERROR', e);
            }
        }

        function logError(msg) {
            var err = record.create({ type: ERROR_REC_TYPE });
            err.setValue({ fieldId: ERR_DATE_FIELD, value: new Date() });
            err.setValue({ fieldId: ERR_MSG_FIELD, value: msg });
            err.save({ ignoreMandatoryFields: true });
        }

        function parseCsv(text) {
            var lines = text.split(/\r?\n/);
            var headers = parseCsvLine(lines[0]);
            var out = [];

            for (var i = 1; i < lines.length; i++) {
                if (!lines[i]) continue;

                var cols = parseCsvLine(lines[i]);
                var o = {};

                for (var j = 0; j < headers.length; j++) {
                    o[headers[j].trim()] = cols[j] ? cols[j].trim() : '';
                }

                out.push(o);
            }

            return out;
        }

        function parseCsvLine(line) {
            var result = [];
            var current = '';
            var inQuotes = false;

            for (var i = 0; i < line.length; i++) {
                var char = line[i];

                if (char == '"') {
                    inQuotes = !inQuotes;
                } else if (char == ',' && !inQuotes) {
                    result.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }

            result.push(current);

            return result;
        }

        /* ================= LOADERS ================= */
        function loadLocations() {
            LOCATION_MAP = {};
            search.create({
                type: 'location',
                filters: [['isinactive', 'is', 'F'], 'AND', ['custrecord_vs_semnox_location', 'is', 'T']],
                columns: ['name', 'internalid']
            }).run().each(function (r) {
                LOCATION_MAP[normalize(r.getValue('name'))] = r.getValue('internalid');
                return true;
            });
        }

        function loadCustomers() {
            CUSTOMER_MAP = {};
            search.create({
                type: 'customer',
                filters: [['isinactive', 'is', 'F'], 'AND', ['parentcustomer.internalid', 'anyof', '732']],
                columns: [
                    search.createColumn({
                        name: 'formulatext',
                        formula: "REPLACE({altname}, 'Semnox Customer :', '')"
                    }),
                    'internalid'
                ]
            }).run().each(function (r) {
                CUSTOMER_MAP[normalize(r.getValue({ name: 'formulatext' }))] = r.getValue('internalid');
                return true;
            });
        }

        function loadItems() {
            ITEM_MAP = {};
            search.create({
                type: 'item',
                filters: [['isinactive', 'is', 'F'], 'AND', ['parent', 'anyof', '950']],
                columns: [
                    search.createColumn({
                        name: 'formulatext',
                        formula: "REPLACE({name}, 'Semnox item :', '')"
                    }),
                    'internalid'
                ]
            }).run().each(function (r) {
                ITEM_MAP[normalize(r.getValue({ name: 'formulatext' }))] = r.getValue('internalid');
                return true;
            });
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce
        };
    });