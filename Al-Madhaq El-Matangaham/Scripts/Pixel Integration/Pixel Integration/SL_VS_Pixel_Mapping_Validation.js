/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Pixel Mapping Validation
 */

define(['N/ui/serverWidget', 'N/https', 'N/search', 'N/log', 'N/file', 'N/url', 'N/runtime'],
    function (serverWidget, https, search, log, file, url, runtime) {

        /*
         * Possible header names for the transaction date column in the Pixel CSV.
         * Checked in this order, case-insensitive. Add the real header name here if it differs.
         */
        var DATE_COLUMN_CANDIDATES = [
            'opendate', 'transaction_date', 'trans_date', 'transactiondate', 'txn_date',
            'sales_date', 'sale_date', 'invoice_date', 'bill_date',
            'order_date', 'created_date', 'trandate', 'date'
        ];

        var API_BASE = 'https://eoi.wecreatives.agency/api/HQEOI/DownloadSalesReport';

        function onRequest(context) {

            try {

                log.debug('Suitelet', 'Start Pixel Mapping Validation');

                var download = context.request.parameters.custpage_download;

                if (download == 'T') {
                    log.debug('Download Request', 'Generating missing mappings CSV');
                    generateMissingCSV(context);
                    return;
                }

                if (context.request.method == 'GET') {
                    context.response.writePage(createForm());
                    return;
                }

                var fromDate = context.request.parameters.custpage_from_date;
                var toDate = context.request.parameters.custpage_to_date;

                log.debug('POST Dates', { fromDate: fromDate, toDate: toDate });

                if (!fromDate || !toDate) {

                    var errorForm = createForm();

                    errorForm.addField({
                        id: 'custpage_error',
                        type: serverWidget.FieldType.INLINEHTML,
                        label: 'Error'
                    }).defaultValue =
                        '<div style="color:red; font-weight:bold; padding:10px;">' +
                        'Please enter both From Date and To Date.' +
                        '</div>';

                    context.response.writePage(errorForm);
                    return;
                }

                var validation = runValidation(fromDate, toDate);

                var form = createForm();

                addResultsToForm(
                    form,
                    validation.itemResults,
                    validation.paymentResults,
                    validation.branchResults,
                    fromDate,
                    toDate
                );

                context.response.writePage(form);

            } catch (e) {

                log.error('Suitelet Error', {
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                });

                var errForm = createForm();

                errForm.addField({
                    id: 'custpage_error',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Error'
                }).defaultValue =
                    '<div style="padding:15px; background:#ffe5e5; border:1px solid #ff0000; color:#990000;">' +
                    '<h3>Validation Error</h3>' +
                    '<div>' + escapeHtml(e.message || e) + '</div>' +
                    '</div>';

                context.response.writePage(errForm);
            }
        }

        /*
         * Calls the Pixel API and validates items / payment methods / branches.
         */
        function runValidation(fromDate, toDate) {

            var formattedFrom = convertDateFormat(fromDate);
            var formattedTo = convertDateFormat(toDate);

            log.debug('Formatted Dates', { from: formattedFrom, to: formattedTo });

            var apiUrl = API_BASE + '?fromDate=' + formattedFrom + '&toDate=' + formattedTo;

            log.audit('Pixel API URL', apiUrl);

            var response = https.get({ url: apiUrl });

            log.debug('API Response Code', response.code);

            if (response.code < 200 || response.code >= 300) {
                throw new Error('Pixel API call failed. HTTP Code: ' + response.code);
            }

            var csv = response.body || '';

            if (!csv) {
                throw new Error('Pixel API returned an empty response.');
            }

            var rows = parseCSV(csv);

            log.audit('API Rows', rows.length);

            if (rows.length == 0) {
                throw new Error('No data was returned from the Pixel API.');
            }

            log.debug('CSV Headers', Object.keys(rows[0]));

            var mappings = getDistinctValues(rows);

            log.audit('Distinct Mapping Values', {
                items: mappings.items.length,
                paymentMethods: mappings.paymentMethods.length,
                branches: mappings.branches.length
            });

            var itemResults = validateItems(mappings.items);
            var paymentResults = validatePaymentMethods(mappings.paymentMethods, mappings.paymentDates);
            var branchResults = validateBranches(mappings.branches, mappings.branchDates);

            return {
                itemResults: itemResults,
                paymentResults: paymentResults,
                branchResults: branchResults
            };
        }

        function createForm() {

            try {

                var form = serverWidget.createForm({
                    title: 'Pixel Mapping Validation'
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
                    label: 'Validate Mapping'
                });

                return form;

            } catch (e) {
                log.error('Create Form Error', e);
                throw e;
            }
        }

        /*
         * Returns the transaction date text of a CSV row (empty string if not found).
         */
        function getRowDate(row) {

            var lowerKeyMap = {};
            var rowKeys = Object.keys(row);

            for (var k = 0; k < rowKeys.length; k++) {
                lowerKeyMap[trimSafe(rowKeys[k]).toLowerCase()] = rowKeys[k];
            }

            for (var c = 0; c < DATE_COLUMN_CANDIDATES.length; c++) {

                var realKey = lowerKeyMap[DATE_COLUMN_CANDIDATES[c]];

                if (realKey !== undefined) {

                    var val = trimSafe(row[realKey]);

                    if (val) {
                        return normalizeDate(val);
                    }
                }
            }

            return '';
        }

        /*
         * Adds a date to an entry's unique date list.
         * entry = { dates: [], seen: {} }
         */
        function addDate(entry, dateText) {

            if (!dateText || entry.seen[dateText]) {
                return;
            }

            entry.seen[dateText] = true;
            entry.dates.push(dateText);
        }

        /*
         * Pixel sends dates as M/D/YYYY H:mm (e.g. 9/1/2026 0:00 = 1 Sep 2026).
         * Returns D/M/YYYY without the time, matching the NetSuite date format.
         * If the value doesn't match the pattern it is returned as is.
         */
        function normalizeDate(value) {

            var datePart = trimSafe(value).split(' ')[0];
            var parts = datePart.split('/');

            if (parts.length != 3) {
                return trimSafe(value);
            }

            return parseInt(parts[1], 10) + '/' + parseInt(parts[0], 10) + '/' + parts[2];
        }

        function dateSortKey(dmy) {

            var p = dmy.split('/');

            if (p.length != 3) {
                return 0;
            }

            return Number(p[2]) * 10000 + Number(p[1]) * 100 + Number(p[0]);
        }

        function joinDates(entry) {

            if (!entry || !entry.dates) {
                return '';
            }

            return entry.dates.slice().sort(function (a, b) {
                return dateSortKey(a) - dateSortKey(b);
            }).join(', ');
        }

        function getDistinctValues(rows) {

            try {

                var itemMap = {};
                var emptyRefCodeMap = {};
                var paymentMap = {};
                var branchMap = {};

                for (var i = 0; i < rows.length; i++) {

                    var row = rows[i];

                    var prodType = '';
                    var amountText = '';
                    var rowKeys = Object.keys(row);

                    for (var k = 0; k < rowKeys.length; k++) {

                        var key = trimSafe(rowKeys[k]).toLowerCase();

                        if (key == 'prodtype') {
                            prodType = trimSafe(row[rowKeys[k]]);
                        }

                        if (key == 'total_including_tax') {
                            amountText = trimSafe(row[rowKeys[k]]);
                        }
                    }

                    var amount = Number(amountText.replace(/,/g, ''));

                    log.debug('Pixel Line Check', {
                        rowNumber: i + 1,
                        prodType: prodType,
                        amount: amountText
                    });

                    if (prodType == '100' || prodType == '101') {

                        log.debug('Discount Line Ignored', {
                            rowNumber: i + 1,
                            prodType: prodType,
                            refCode: trimSafe(row['REFCODE']),
                            productName: trimSafe(row['Product_Name']),
                            amount: amountText
                        });

                        continue;
                    }

                    if (/^\d+$/.test(prodType)) {

                        var prodTypeNumber = parseInt(prodType, 10);

                        if (prodTypeNumber >= 0 && prodTypeNumber <= 12 && amount < 0) {

                            log.debug('Negative Amount Line Ignored', {
                                rowNumber: i + 1,
                                prodType: prodType,
                                refCode: trimSafe(row['REFCODE']),
                                productName: trimSafe(row['Product_Name']),
                                amount: amountText
                            });

                            continue;
                        }
                    }

                    var refCode = trimSafe(row['REFCODE']);
                    var productName = trimSafe(row['Product_Name']);
                    var paymentMethod = trimSafe(row['Payment_Method']);
                    var snum = trimSafe(row['SNUM']);
                    var rowDate = getRowDate(row);

                    if (refCode) {

                        if (!itemMap[refCode]) {
                            itemMap[refCode] = {
                                refCode: refCode,
                                productName: productName,
                                dates: [],
                                seen: {}
                            };
                        }

                        addDate(itemMap[refCode], rowDate);

                    } else if (productName) {

                        if (!emptyRefCodeMap[productName]) {
                            emptyRefCodeMap[productName] = {
                                refCode: '',
                                productName: productName,
                                dates: [],
                                seen: {}
                            };
                        }

                        addDate(emptyRefCodeMap[productName], rowDate);
                    }

                    if (paymentMethod) {

                        if (!paymentMap[paymentMethod]) {
                            paymentMap[paymentMethod] = { dates: [], seen: {} };
                        }

                        addDate(paymentMap[paymentMethod], rowDate);
                    }

                    if (snum) {

                        if (!branchMap[snum]) {
                            branchMap[snum] = { dates: [], seen: {} };
                        }

                        addDate(branchMap[snum], rowDate);
                    }
                }

                var items = Object.keys(itemMap).map(function (key) {
                    return itemMap[key];
                });

                /* Add distinct products with empty REFCODE. */
                var emptyRefCodeItems = Object.keys(emptyRefCodeMap).map(function (key) {
                    return emptyRefCodeMap[key];
                });

                for (var e = 0; e < emptyRefCodeItems.length; e++) {
                    items.push(emptyRefCodeItems[e]);
                }

                var paymentMethods = Object.keys(paymentMap);
                var branches = Object.keys(branchMap);

                log.debug('Distinct Items Count', items.length);
                log.debug('Distinct Empty REFCODE Items', emptyRefCodeItems.length);
                log.debug('Distinct Payment Methods', paymentMethods);
                log.debug('Distinct SNUM Values', branches);

                return {
                    items: items,
                    paymentMethods: paymentMethods,
                    paymentDates: paymentMap,
                    branches: branches,
                    branchDates: branchMap
                };

            } catch (e) {
                log.error('Get Distinct Values Error', e);
                throw e;
            }
        }

        function validateItems(items) {

            try {

                var result = {
                    total: items.length,
                    correct: 0,
                    missing: 0,
                    missingValues: []
                };

                if (items.length == 0) {
                    return result;
                }

                var filters = [];
                var nonEmptyItems = [];

                for (var i = 0; i < items.length; i++) {
                    if (items[i].refCode) {
                        nonEmptyItems.push(items[i].refCode);
                    }
                }

                for (var j = 0; j < nonEmptyItems.length; j++) {

                    if (j > 0) {
                        filters.push('OR');
                    }

                    filters.push(['upccode', 'is', nonEmptyItems[j]]);
                }

                log.debug('Item Search Filter Count', nonEmptyItems.length);

                var mappedItems = {};

                if (nonEmptyItems.length > 0) {

                    var itemSearch = search.create({
                        type: 'item',
                        filters: filters,
                        columns: [
                            search.createColumn({ name: 'internalid' }),
                            search.createColumn({ name: 'upccode' })
                        ]
                    });

                    var itemSearchResults = getAllResults(itemSearch);

                    for (var x = 0; x < itemSearchResults.length; x++) {

                        var upc = trimSafe(itemSearchResults[x].getValue({ name: 'upccode' }));

                        if (upc) {
                            mappedItems[upc] = true;
                        }
                    }
                }

                for (var y = 0; y < items.length; y++) {

                    var refCode = trimSafe(items[y].refCode);
                    var productName = trimSafe(items[y].productName);
                    var dates = joinDates(items[y]);

                    if (!refCode) {

                        result.missing++;

                        result.missingValues.push({
                            productName: productName,
                            value: '',
                            status: 'Empty from Pixel',
                            dates: dates
                        });

                    } else if (mappedItems[refCode]) {

                        result.correct++;

                    } else {

                        result.missing++;

                        result.missingValues.push({
                            productName: productName,
                            value: refCode,
                            status: 'Missing in NetSuite',
                            dates: dates
                        });
                    }
                }

                log.audit('Item Validation', {
                    total: result.total,
                    correct: result.correct,
                    missing: result.missing
                });

                return result;

            } catch (e) {
                log.error('Item Validation Error', e);
                throw e;
            }
        }

        function validatePaymentMethods(paymentMethods, paymentDates) {

            try {

                var result = {
                    total: paymentMethods.length,
                    correct: 0,
                    missing: 0,
                    missingValues: []
                };

                if (paymentMethods.length == 0) {
                    return result;
                }

                var filters = [];

                for (var i = 0; i < paymentMethods.length; i++) {

                    if (i > 0) {
                        filters.push('OR');
                    }

                    filters.push(['entityid', 'is', paymentMethods[i]]);
                }

                log.debug('Payment Method Search Filter Count', paymentMethods.length);

                var customerSearch = search.create({
                    type: 'customer',
                    filters: filters,
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'entityid' })
                    ]
                });

                var customerResults = getAllResults(customerSearch);

                var mappedPayments = {};

                for (var j = 0; j < customerResults.length; j++) {

                    var entityId = trimSafe(customerResults[j].getValue({ name: 'entityid' }));

                    if (entityId) {
                        mappedPayments[entityId] = true;
                    }
                }

                for (var x = 0; x < paymentMethods.length; x++) {

                    if (mappedPayments[paymentMethods[x]]) {

                        result.correct++;

                    } else {

                        result.missing++;

                        result.missingValues.push({
                            productName: '',
                            value: paymentMethods[x],
                            status: 'Missing',
                            dates: joinDates(paymentDates[paymentMethods[x]])
                        });
                    }
                }

                log.audit('Payment Method Validation', {
                    total: result.total,
                    correct: result.correct,
                    missing: result.missing
                });

                return result;

            } catch (e) {
                log.error('Payment Method Validation Error', e);
                throw e;
            }
        }

        function validateBranches(branches, branchDates) {

            try {

                var result = {
                    total: branches.length,
                    correct: 0,
                    missing: 0,
                    missingValues: []
                };

                if (branches.length == 0) {
                    return result;
                }

                var filters = [];

                for (var i = 0; i < branches.length; i++) {

                    if (i > 0) {
                        filters.push('OR');
                    }

                    filters.push(['custrecord_5826_loc_branch_id', 'is', branches[i]]);
                }

                log.debug('Branch Search Filter Count', branches.length);
                log.debug('SNUM Values Sent To Location Search', branches);

                var locationSearch = search.create({
                    type: 'location',
                    filters: filters,
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'name' }),
                        search.createColumn({ name: 'custrecord_5826_loc_branch_id' })
                    ]
                });

                var locationResults = getAllResults(locationSearch);

                log.debug('Location Search Results Count', locationResults.length);

                var mappedBranches = {};

                for (var j = 0; j < locationResults.length; j++) {

                    var branchId = trimSafe(locationResults[j].getValue({ name: 'custrecord_5826_loc_branch_id' }));
                    var locationName = trimSafe(locationResults[j].getValue({ name: 'name' }));
                    var locationInternalId = trimSafe(locationResults[j].getValue({ name: 'internalid' }));

                    log.debug('Location Branch Mapping', {
                        locationInternalId: locationInternalId,
                        locationName: locationName,
                        branchId: branchId
                    });

                    if (branchId) {
                        mappedBranches[branchId] = {
                            internalId: locationInternalId,
                            name: locationName
                        };
                    }
                }

                for (var x = 0; x < branches.length; x++) {

                    var snum = trimSafe(branches[x]);

                    if (mappedBranches[snum]) {

                        result.correct++;

                    } else {

                        result.missing++;

                        result.missingValues.push({
                            productName: '',
                            value: snum,
                            status: 'Missing',
                            dates: joinDates(branchDates[branches[x]])
                        });
                    }
                }

                log.audit('Branch / SNUM Validation', {
                    total: result.total,
                    correct: result.correct,
                    missing: result.missing
                });

                return result;

            } catch (e) {
                log.error('Branch Validation Error', e);
                throw e;
            }
        }

        function addResultsToForm(form, itemResults, paymentResults, branchResults, fromDate, toDate) {

            try {

                var html = '';

                var downloadUrl = url.resolveScript({
                    scriptId: runtime.getCurrentScript().id,
                    deploymentId: runtime.getCurrentScript().deploymentId,
                    params: {
                        custpage_download: 'T',
                        custpage_from_date: fromDate,
                        custpage_to_date: toDate
                    }
                });

                html += '<style>';
                html += '.pixel-container {font-family: Arial, sans-serif; padding: 15px;}';
                html += '.pixel-date {background:#f5f5f5; padding:12px; margin-bottom:20px; border-radius:5px;}';
                html += '.pixel-section {margin-bottom:30px; border:1px solid #ddd; border-radius:6px; overflow:hidden;}';
                html += '.pixel-title {font-size:18px; font-weight:bold; padding:12px; background:#eeeeee;}';
                html += '.pixel-summary {display:flex; gap:15px; padding:15px; background:#fafafa;}';
                html += '.pixel-card {flex:1; padding:15px; border:1px solid #ddd; border-radius:5px; text-align:center; background:white;}';
                html += '.pixel-number {font-size:25px; font-weight:bold; display:block; margin-top:5px;}';
                html += '.pixel-green {color:green;}';
                html += '.pixel-red {color:red;}';
                html += '.pixel-table {width:100%; border-collapse:collapse;}';
                html += '.pixel-table th, .pixel-table td {border:1px solid #ddd; padding:10px; text-align:left;}';
                html += '.pixel-table th {background:#f2f2f2;}';
                html += '.pixel-missing {padding:15px;}';
                html += '.pixel-download {margin-bottom:20px; padding:12px; background:#f5f5f5; border:1px solid #ddd; border-radius:5px;}';
                html += '.pixel-download a {display:inline-block; padding:10px 18px; background:#1976d2; color:white; text-decoration:none; border-radius:4px; font-weight:bold;}';
                html += '</style>';

                html += '<div class="pixel-container">';

                html +=
                    '<div class="pixel-date">' +
                    '<b>Validation Period:</b> ' +
                    escapeHtml(fromDate) + ' to ' + escapeHtml(toDate) +
                    '</div>';

                html +=
                    '<div class="pixel-download">' +
                    '<a href="' + downloadUrl + '">Download Missing Results</a>' +
                    '</div>';

                html += buildSection('Item Mapping', 'REFCODE', itemResults);
                html += buildSection('Payment Method Mapping', 'Payment Method', paymentResults);
                html += buildSection('Branch / Location Mapping', 'Branch', branchResults);

                html += '</div>';

                form.addField({
                    id: 'custpage_validation_results',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Validation Results'
                }).defaultValue = html;

            } catch (e) {
                log.error('Add Results To Form Error', e);
                throw e;
            }
        }

        function buildSection(title, columnName, result) {

            var html = '';

            html += '<div class="pixel-section">';
            html += '<div class="pixel-title">' + title + '</div>';

            html += '<div class="pixel-summary">';

            html +=
                '<div class="pixel-card"><div>Total</div>' +
                '<span class="pixel-number">' + result.total + '</span></div>';

            html +=
                '<div class="pixel-card"><div>Correct Mapping</div>' +
                '<span class="pixel-number pixel-green">' + result.correct + '</span></div>';

            html +=
                '<div class="pixel-card"><div>Missing Mapping</div>' +
                '<span class="pixel-number pixel-red">' + result.missing + '</span></div>';

            html += '</div>';

            if (result.missingValues.length > 0) {

                html += '<div class="pixel-missing">';
                html += '<table class="pixel-table">';
                html += '<thead><tr>';
                html += '<th>#</th>';

                if (title == 'Item Mapping') {
                    html += '<th>Product Name</th>';
                }

                html += '<th>' + columnName + '</th>';
                html += '<th>Status</th>';
                html += '<th>Date(s)</th>';
                html += '</tr></thead>';
                html += '<tbody>';

                for (var i = 0; i < result.missingValues.length; i++) {

                    var missingValue = result.missingValues[i];

                    var missingText = missingValue.value;
                    var missingStatus = missingValue.status;
                    var productName = missingValue.productName || '';
                    var dates = missingValue.dates || '';

                    if (!missingText) {
                        missingText = '[Empty REFCODE]';
                    }

                    var statusColor = 'red';

                    if (missingStatus == 'Empty from Pixel') {
                        statusColor = '#e67e22';
                    }

                    html += '<tr>';
                    html += '<td>' + (i + 1) + '</td>';

                    if (title == 'Item Mapping') {
                        html += '<td>' + escapeHtml(productName) + '</td>';
                    }

                    html += '<td>' + escapeHtml(missingText) + '</td>';

                    html +=
                        '<td style="color:' + statusColor + '; font-weight:bold;">' +
                        escapeHtml(missingStatus) +
                        '</td>';

                    html += '<td>' + escapeHtml(dates) + '</td>';

                    html += '</tr>';
                }

                html += '</tbody></table></div>';

            } else {

                html +=
                    '<div style="padding:15px; color:green; font-weight:bold;">' +
                    'All mappings are correct.' +
                    '</div>';
            }

            html += '</div>';

            return html;
        }

        function csvEscape(value) {

            try {

                var text = trimSafe(value);

                if (
                    text.charAt(0) == '=' ||
                    text.charAt(0) == '+' ||
                    text.charAt(0) == '-' ||
                    text.charAt(0) == '@'
                ) {
                    text = "'" + text;
                }

                text = text.replace(/"/g, '""');

                return '"' + text + '"';

            } catch (e) {
                log.error('CSV Escape Error', e);
                return '""';
            }
        }

        function getAllResults(savedSearch) {

            try {

                var results = [];
                var start = 0;
                var batchSize = 1000;

                var searchResult = savedSearch.run();

                while (true) {

                    var batch = searchResult.getRange({
                        start: start,
                        end: start + batchSize
                    });

                    if (!batch || batch.length == 0) {
                        break;
                    }

                    for (var i = 0; i < batch.length; i++) {
                        results.push(batch[i]);
                    }

                    if (batch.length < batchSize) {
                        break;
                    }

                    start += batchSize;
                }

                log.debug('Search Results Count', results.length);

                return results;

            } catch (e) {
                log.error('Get All Search Results Error', e);
                throw e;
            }
        }

        function parseCSV(csvText) {

            try {

                var rows = [];
                var i = 0;
                var field = '';
                var row = [];
                var inQuotes = false;

                function pushField() {
                    row.push(field);
                    field = '';
                }

                function pushRow() {
                    rows.push(row);
                    row = [];
                }

                while (i < csvText.length) {

                    var c = csvText[i];

                    if (inQuotes) {

                        if (c == '"') {

                            var next = csvText[i + 1];

                            if (next == '"') {
                                field += '"';
                                i += 2;
                                continue;
                            }

                            inQuotes = false;
                            i++;
                            continue;
                        }

                        field += c;
                        i++;
                        continue;
                    }

                    if (c == '"') {
                        inQuotes = true;
                        i++;
                        continue;
                    }

                    if (c == ',') {
                        pushField();
                        i++;
                        continue;
                    }

                    if (c == '\r') {
                        i++;
                        continue;
                    }

                    if (c == '\n') {
                        pushField();
                        pushRow();
                        i++;
                        continue;
                    }

                    field += c;
                    i++;
                }

                pushField();

                if (row.length > 1 || (row.length == 1 && row[0] != '')) {
                    pushRow();
                }

                if (rows.length == 0) {
                    return [];
                }

                var header = rows[0].map(function (h) {
                    return trimSafe(h);
                });

                var data = [];

                for (var r = 1; r < rows.length; r++) {

                    var obj = {};

                    for (var col = 0; col < header.length; col++) {
                        obj[header[col]] = rows[r][col] != null ? String(rows[r][col]) : '';
                    }

                    data.push(obj);
                }

                return data;

            } catch (e) {
                log.error('CSV Parse Error', e);
                throw e;
            }
        }

        function generateMissingCSV(context) {

            try {

                var fromDate = context.request.parameters.custpage_from_date;
                var toDate = context.request.parameters.custpage_to_date;

                log.audit('CSV Download Dates', { fromDate: fromDate, toDate: toDate });

                if (!fromDate || !toDate) {
                    throw new Error('From Date and To Date are required.');
                }

                var validation = runValidation(fromDate, toDate);

                var itemResults = validation.itemResults;
                var paymentResults = validation.paymentResults;
                var branchResults = validation.branchResults;

                log.audit('CSV Missing Results', {
                    items: itemResults.missing,
                    paymentMethods: paymentResults.missing,
                    branches: branchResults.missing
                });

                var output = 'Mapping Type,Product Name,Value,Status,Date(s)\n';

                function addLines(typeLabel, missingValues) {

                    for (var i = 0; i < missingValues.length; i++) {

                        var m = missingValues[i];

                        output +=
                            csvEscape(typeLabel) + ',' +
                            csvEscape(m.productName || '') + ',' +
                            csvEscape(m.value || '[Empty REFCODE]') + ',' +
                            csvEscape(m.status || 'Missing') + ',' +
                            csvEscape(m.dates || '') +
                            '\n';
                    }
                }

                addLines('Item', itemResults.missingValues);
                addLines('Payment Method', paymentResults.missingValues);
                addLines('Branch', branchResults.missingValues);

                /* If there are no missing mappings, still return a valid CSV. */
                if (
                    itemResults.missing == 0 &&
                    paymentResults.missing == 0 &&
                    branchResults.missing == 0
                ) {
                    output += 'No Missing Mappings,,,,\n';
                }

                log.audit('CSV Generated', 'CSV length: ' + output.length);

                var csvFile = file.create({
                    name: 'Pixel_Missing_Mappings.csv',
                    fileType: file.Type.CSV,
                    contents: output,
                    encoding: file.Encoding.UTF8
                });

                context.response.writeFile({
                    file: csvFile,
                    isInline: false
                });

            } catch (e) {

                log.error('Generate Missing CSV Error', {
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                });

                context.response.write('Error generating CSV: ' + escapeHtml(e.message || e));
            }
        }

        function convertDateFormat(dateStr) {

            try {

                if (!dateStr) {
                    throw new Error('Invalid Date');
                }

                var parts = dateStr.split('/');

                if (parts.length != 3) {
                    throw new Error('Invalid date format: ' + dateStr);
                }

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
                    throw new Error('Invalid month: ' + monthNumber);
                }

                return day + '-' + monthText + '-' + yearShort;

            } catch (e) {
                log.error('Date Conversion Error', e);
                throw e;
            }
        }

        function trimSafe(value) {

            try {

                if (value == null) {
                    return '';
                }

                return String(value).trim();

            } catch (e) {
                log.error('trimSafe Error', e);
                return '';
            }
        }

        function escapeHtml(value) {

            try {

                return String(value)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');

            } catch (e) {
                log.error('Escape HTML Error', e);
                return '';
            }
        }

        return {
            onRequest: onRequest
        };

    }
);