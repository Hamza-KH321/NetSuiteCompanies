/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Pixel SO Integration
 */
define(['N/https', 'N/record', 'N/search', 'N/runtime', 'N/log', 'N/format'],
    function (https, record, search, runtime, log, format) {

        // ----- Constants & Config -----
        const PIXEL_FORM_ID = 110;
        const PIXEL_SO_FLAG_FIELD = 'custbody_vs_pixel_transaction';
        const PIXEL_ERROR_REC = 'customrecord_vs_pixel_integration_errors';
        const PIXEL_ERR_DATE_FIELD = 'custrecord_vs_date_time_created';
        const PIXEL_ERR_MSG_FIELD = 'custrecord_vs_error_message';

        const TAX_CODE_TAXABLE_15 = 6;
        const TAX_CODE_NON_TAXABLE_0 = 15;

        const FLD_TXN_NO = 'custcol_vs_pixel_transaction_no';
        const FLD_CASHIER = 'custcol_vs_cashier_name';
        const FLD_POS_ID = 'custcol_vs_pos_id';
        const FLD_UNIQUEID = 'custcol_vs_unique_id';

        const trimSafe = function (v) {
            return (v == null) ? '' : String(v).trim();
        };

        function getInputData() {

            try {

                const urlParam = runtime.getCurrentScript().getParameter({
                    name: 'custscript_vs_pixel_api_url'
                });

                if (!urlParam) {
                    throw new Error('Missing script parameter custscript_vs_pixel_api_url.');
                }

                log.audit('PIXEL Fetch', urlParam);

                const resp = https.get({ url: urlParam });

                if (resp.code < 200 || resp.code >= 300) {
                    throw new Error('API call failed. HTTP ' + resp.code);
                }

                const csv = resp.body || '';
                const rows = parseCSV(csv);

                log.audit('PIXEL Parsed Rows', rows.length);

                var existingOrdersMap = {};

                try {

                    var uniqueDates = [];

                    for (var d = 0; d < rows.length; d++) {

                        var rawDate = trimSafe(rows[d]['OPENDATE']);

                        if (!rawDate) {
                            continue;
                        }

                        var convertedDate = convertApiDate(rawDate);

                        if (uniqueDates.indexOf(convertedDate) == -1) {
                            uniqueDates.push(convertedDate);
                        }
                    }

                    log.audit('Unique Dates Found', uniqueDates);

                    for (var ud = 0; ud < uniqueDates.length; ud++) {

                        var searchDate = uniqueDates[ud];

                        const salesorderSearchObj = search.create({
                            type: "salesorder",
                            settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                            filters:
                                [
                                    ["type", "anyof", "SalesOrd"],
                                    "AND",
                                    ["mainline", "is", "T"],
                                    "AND",
                                    [PIXEL_SO_FLAG_FIELD, "is", "T"],
                                    "AND",
                                    ["trandate", "on", searchDate]
                                ],
                            columns:
                                [
                                    search.createColumn({
                                        name: "formulatext",
                                        formula: "{location.custrecord_5826_loc_branch_id} || '-' || {mainname} || '-' || TO_CHAR({trandate}, 'YYYY-MM-DD')",
                                        label: "Formula (Text)"
                                    })
                                ]
                        });

                        var searchResults = salesorderSearchObj.run().getRange({
                            start: 0,
                            end: 1000
                        });

                        for (var i = 0; i < searchResults.length; i++) {

                            var existingKey = trimSafe(
                                searchResults[i].getValue({
                                    name: "formulatext",
                                    formula: "{location.custrecord_5826_loc_branch_id} || '-' || {mainname} || '-' || TO_CHAR({trandate}, 'YYYY-MM-DD')"
                                })
                            );

                            if (existingKey) {
                                existingOrdersMap[existingKey] = true;
                            }
                        }
                    }

                    log.audit('Existing Orders Found', Object.keys(existingOrdersMap).length);

                } catch (searchErr) {

                    log.error('Existing Orders Search Error', searchErr);
                }

                var filteredRows = [];

                for (var r = 0; r < rows.length; r++) {

                    var row = rows[r];

                    var branchId = trimSafe(row['SNUM']);
                    var paymentMethod = trimSafe(row['Payment_Method']);

                    var rawApiDate = trimSafe(row['OPENDATE']);
                    var convertedApiDate = convertApiDate(rawApiDate);

                    var dateParts = convertedApiDate.split('/');

                    var finalDate =
                        dateParts[2] + '-' +
                        ('0' + dateParts[1]).slice(-2) + '-' +
                        ('0' + dateParts[0]).slice(-2);

                    var compareKey =
                        branchId + '-' +
                        paymentMethod + '-' +
                        finalDate;

                    if (existingOrdersMap[compareKey]) {

                        log.audit('Skipping Existing Order Group', compareKey);
                        continue;
                    }

                    filteredRows.push(row);
                }

                log.audit('Filtered Rows Count', filteredRows.length);

                return filteredRows;

            } catch (e) {

                createErrorLog('getInputData: ' + (e.message || e));
                throw e;
            }
        }

        function map(context) {

            const row = JSON.parse(context.value);

            const payment = trimSafe(row['Payment_Method']);
            const branch = trimSafe(row['Branch']);

            const key = payment + '|' + branch;

            context.write({ key: key, value: row });
        }

        function reduce(context) {

            const parts = context.key.split('|');
            const payment = trimSafe(parts[0]);
            const branch = trimSafe(parts[1]);

            let soId = null;
            let lineCount = 0;
            let lineErrors = 0;

            try {

                const firstRow = JSON.parse(context.values[0]);
                const snum = trimSafe(firstRow['SNUM']);
                var openDateRaw = trimSafe(firstRow['OPENDATE']);

                const locationId = findLocationByBranchId(snum);

                const so = record.create({ type: record.Type.SALES_ORDER, isDynamic: true });

                so.setValue({ fieldId: 'customform', value: PIXEL_FORM_ID });
                so.setValue({ fieldId: PIXEL_SO_FLAG_FIELD, value: true });

                // ----- Set Transaction Date From API (OPENDATE) -----
                try {

                    var openDateRaw = trimSafe(firstRow['OPENDATE']);

                    if (openDateRaw) {

                        var formattedTranDate = convertApiDate(openDateRaw);

                        so.setText({ fieldId: 'trandate', text: formattedTranDate });

                    } else {
                        log.audit('OPENDATE Missing', 'Using system default date.');
                    }

                } catch (dateErr) {
                    log.error('Error Setting Transaction Date', dateErr);
                }

                if (!payment) {
                    throw new Error('Payment Method is missing from source data.');
                }

                // validate mapping (important)
                try {
                    so.setText({ fieldId: 'entity', text: payment });
                } catch (e) {
                    throw new Error(
                        'Payment Method "' + payment + '" is not mapped to any Customer in NetSuite.'
                    );
                }

                var paymentModeText = (payment.toLowerCase() == 'cash') ? 'Paid' : 'Credit';

                so.setText({ fieldId: 'entity', text: payment });
                so.setValue({ fieldId: 'orderstatus', value: 'B' });
                so.setText({ fieldId: 'custbody_ium_payment_method', text: payment });
                so.setText({ fieldId: 'custbody_ium_payment_mode', text: paymentModeText });

                if (locationId) {
                    so.setValue({ fieldId: 'location', value: Number(locationId) });
                } else {
                    throw new Error(
                        'Branch "' + branch + '" (SNUM: ' + snum + ') is not mapped to any Location in NetSuite.'
                    );
                }

                var upcList = [];

                for (var i = 0; i < context.values.length; i++) {

                    var rowObj = JSON.parse(context.values[i]);
                    var code = trimSafe(rowObj['REFCODE']);

                    if (code && upcList.indexOf(code) == -1) {
                        upcList.push(code);
                    }
                }

                var itemCache = {};

                if (upcList.length > 0) {

                    var filterExpression = [];

                    for (var f = 0; f < upcList.length; f++) {

                        if (f > 0) {
                            filterExpression.push('OR');
                        }

                        filterExpression.push(['upccode', 'is', upcList[f]]);
                    }

                    var itemSearch = search.create({
                        type: 'item',
                        filters: filterExpression,
                        columns: ['internalid', 'upccode']
                    });

                    var results = itemSearch.run().getRange({ start: 0, end: 1000 });

                    for (var j = 0; j < results.length; j++) {

                        var upc = trimSafe(results[j].getValue('upccode'));
                        var id = results[j].getValue('internalid');

                        if (upc) {
                            itemCache[upc] = id;
                        }
                    }

                    log.debug('Item Cache Built', Object.keys(itemCache).length);
                }

                for (let i = 0; i < context.values.length; i++) {

                    const row = JSON.parse(context.values[i]);
                    let refCode = '';

                    try {

                        refCode = trimSafe(row['REFCODE']);
                        const qty = toNumber(row['QUAN'], 0);
                        const taxAmt = toNumber(row['Tax_Amount'], 0);
                        var rawRate = toNumber(row['Total_Excluding_Tax'], 0);
                        var rate = rawRate < 0 ? 0 : rawRate;

                        var itemName = trimSafe(row['Product_Name']) || 'Unknown Item';

                        if (!refCode) {
                            throw new Error(
                                'Missing Item Code Mapping (REFCODE). Item: "' + itemName + '"'
                            );
                        }

                        if (qty <= 0) {
                            throw new Error('Invalid QUAN "' + row['QUAN'] + '"');
                        }

                        var itemId = itemCache[refCode];

                        if (!itemId) {
                            throw new Error(
                                'Item Mapping Missing in NetSuite. Item: "' + itemName +
                                '" | UPC: "' + refCode + '". Please create or map this item.'
                            );
                        }

                        so.selectNewLine({ sublistId: 'item' });

                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: Number(itemId) });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: qty });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: rate });

                        const taxCodeId = taxAmt > 0 ? TAX_CODE_TAXABLE_15 : TAX_CODE_NON_TAXABLE_0;

                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'taxcode', value: taxCodeId });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: FLD_TXN_NO, value: trimSafe(row['TRANSACT']) });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: FLD_CASHIER, value: trimSafe(row['Cashier_Name']) });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: FLD_POS_ID, value: trimSafe(row['POS']) });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: FLD_UNIQUEID, value: trimSafe(row['UNIQUEID']) });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_ium_pstatus', value: 4 });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_ium_rec_pos_status_li', value: 4 });

                        so.commitLine({ sublistId: 'item' });

                        lineCount++;

                    } catch (lineErr) {

                        lineErrors++;

                        createErrorLog(
                            'Line Error → Payment: "' + payment +
                            '" | Branch: "' + branch +
                            '" | Item Code: "' + refCode +
                            '" | Details: ' + (lineErr.message || lineErr),
                            openDateRaw
                        );

                        throw new Error(
                            'Stopping Sales Order Creation. ' +
                            'Payment: "' + payment + '" | ' +
                            'Branch: "' + branch + '" | ' +
                            'Line Error: ' + (lineErr.message || lineErr)
                        );
                    }
                }

                if (lineCount == 0) {
                    throw new Error('No valid lines to save for this Sales Order.');
                }

                var totalAmount = so.getValue({ fieldId: 'total' });

                so.selectNewLine({ sublistId: 'recmachcustrecord_ium_payment_so' });

                so.setCurrentSublistText({ sublistId: 'recmachcustrecord_ium_payment_so', fieldId: 'custrecord_ium_payment_method', text: payment });
                so.setCurrentSublistValue({ sublistId: 'recmachcustrecord_ium_payment_so', fieldId: 'custrecord_ium_oayment_amount', value: totalAmount });

                so.commitLine({ sublistId: 'recmachcustrecord_ium_payment_so' });

                soId = so.save({ enableSourcing: true, ignoreMandatoryFields: false });

                log.audit('Sales Order Created', {
                    soId: soId,
                    payment: payment,
                    branch: branch,
                    lineCount: lineCount,
                    lineErrors: lineErrors
                });

            } catch (e) {

                createErrorLog(
                    'SO group error [Payment: ' + payment +
                    '] [Branch: ' + branch +
                    '] :: ' + (e.message || e),
                    openDateRaw
                );
            }
        }

        function parseCSV(csvText) {

            const rows = [];
            let i = 0, field = '', row = [], inQuotes = false;

            function pushField() { row.push(field); field = ''; }
            function pushRow() { rows.push(row); row = []; }

            while (i < csvText.length) {

                const c = csvText[i];

                if (inQuotes) {
                    if (c == '"') {
                        const next = csvText[i + 1];
                        if (next == '"') { field += '"'; i += 2; continue; }
                        inQuotes = false; i++; continue;
                    }
                    field += c; i++; continue;
                }

                if (c == '"') { inQuotes = true; i++; continue; }
                if (c == ',') { pushField(); i++; continue; }
                if (c == '\r') { i++; continue; }
                if (c == '\n') { pushField(); pushRow(); i++; continue; }

                field += c; i++;
            }

            pushField();
            if (row.length > 1 || (row.length == 1 && row[0] !== '')) pushRow();

            if (rows.length == 0) return [];

            const header = rows[0].map(function (h) { return trimSafe(h); });
            const data = [];

            for (let r = 1; r < rows.length; r++) {
                const obj = {};
                for (let c = 0; c < header.length; c++) {
                    obj[header[c]] = rows[r][c] != null ? String(rows[r][c]) : '';
                }
                data.push(obj);
            }

            return data;
        }

        function findItemByUPC(upc) {

            const upcTrim = trimSafe(upc);
            if (!upcTrim) return null;

            const s = search.create({
                type: 'item',
                filters: [['upccode', 'is', upcTrim]],
                columns: ['internalid']
            });

            const res = s.run().getRange({ start: 0, end: 1 });

            if (res && res.length) {
                return res[0].getValue('internalid');
            }

            return null;
        }

        function findLocationByBranchId(branchId) {

            const branchTrim = trimSafe(branchId);
            if (!branchTrim) return null;

            try {

                const s = search.create({
                    type: 'location',
                    filters: [['custrecord_5826_loc_branch_id', 'is', branchTrim]],
                    columns: ['internalid']
                });

                const res = s.run().getRange({ start: 0, end: 1 });

                if (res && res.length) {
                    return res[0].getValue('internalid');
                }

            } catch (e) {
                log.error('Location Search Error', e);
            }

            return null;
        }

        function nowDate() {
            return new Date();
        }

        function toNumber(x, fallback) {
            const n = parseFloat(String(x).replace(/,/g, ''));
            return Number.isFinite(n) ? n : fallback;
        }

        function convertApiDate(apiDate) {

            try {

                // Example input:
                // 2/25/2026 12:00:00 AM

                var datePart = apiDate.split(' ')[0]; // 2/25/2026

                var parts = datePart.split('/');

                var month = parts[0];
                var day = parts[1];
                var year = parts[2];

                // Remove leading zero if exists
                if (month.charAt(0) == '0') {
                    month = month.substring(1);
                }

                if (day.charAt(0) == '0') {
                    day = day.substring(1);
                }

                return day + '/' + month + '/' + year;

            } catch (e) {

                log.error('convertApiDate Error', e);
                throw e;
            }
        }

        function createErrorLog(message, transactionDate) {

            try {

                var errorDate = nowDate();

                if (transactionDate) {

                    try {

                        var formattedDate = convertApiDate(transactionDate);

                        errorDate = format.parse({
                            value: formattedDate,
                            type: format.Type.DATE
                        });

                    } catch (dateErr) {
                        log.error('Error Parsing Transaction Date', dateErr);
                    }
                }

                const recId = record.create({
                    type: PIXEL_ERROR_REC
                }).setValue({
                    fieldId: PIXEL_ERR_DATE_FIELD,
                    value: errorDate
                }).setValue({
                    fieldId: PIXEL_ERR_MSG_FIELD,
                    value: String(message).substring(0, 3999)
                }).save({
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                });

                log.error('PIXEL Error Logged', {
                    recId: recId,
                    message: message,
                    transactionDate: transactionDate
                });

            } catch (e) {
                log.error('PIXEL Error Log Failed', String(e));
            }
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce
        };
    });