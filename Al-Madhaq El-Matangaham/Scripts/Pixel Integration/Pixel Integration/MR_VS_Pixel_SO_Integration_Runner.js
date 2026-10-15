/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Pixel SO Integration Runner
 */
define(['N/https', 'N/record', 'N/search', 'N/runtime', 'N/log', 'N/format'],
    function (https, record, search, runtime, log, format) {

        // ----- Constants & Config -----
        var PIXEL_FORM_ID = 117;
        var PIXEL_SO_FLAG_FIELD = 'custbody_vs_pixel_transaction';
        var PIXEL_ERROR_REC = 'customrecord_vs_pixel_integration_errors';
        var PIXEL_ERR_DATE_FIELD = 'custrecord_vs_date_time_created';
        var PIXEL_ERR_MSG_FIELD = 'custrecord_vs_error_message';

        var TAX_CODE_TAXABLE_15 = 6;
        var TAX_CODE_NON_TAXABLE_0 = 7;

        var FLD_TXN_NO = 'custcol_vs_pixel_transaction_no';
        var FLD_CASHIER = 'custcol_vs_cashier_name';
        var FLD_POS_ID = 'custcol_vs_pos_id';
        var FLD_UNIQUEID = 'custcol_vs_unique_id';

        // Header aliases (normalized header -> canonical key used in the code).
        // Replaces the old getRowValue() lookup: matching is now done once per CSV header.
        var HEADER_ALIASES = {
            'transact': 'TRANSACT',
            'prodtype': 'prodtype',
            'prodty': 'prodtype',
            'totalincludingtax': 'Total_Including_Tax',
            'totalexcludingtax': 'Total_Excluding_Tax',
            'taxamount': 'Tax_Amount',
            'unitprice': 'UNIT_PRICE'
        };

        var trimSafe = function (v) {
            return (v == null) ? '' : String(v).trim();
        };

        function getInputData() {

            try {

                var currentScript = runtime.getCurrentScript();

                var urlParam = currentScript.getParameter({
                    name: 'custscript_vs_pixel_api_url_runner'
                });

                var transactFilter = trimSafe(currentScript.getParameter({
                    name: 'custscript_vs_pixel_transact_filter'
                }));

                if (!urlParam) {
                    throw new Error('Missing script parameter custscript_vs_pixel_api_url_runner.');
                }

                log.audit('TRANSACT Filter', transactFilter || 'ALL');

                log.audit('PIXEL Fetch', urlParam);

                var resp = https.get({ url: urlParam });

                if (resp.code < 200 || resp.code >= 300) {
                    throw new Error('API call failed. HTTP ' + resp.code);
                }

                var csv = resp.body || '';
                var rows = parseCSV(csv);

                log.audit('PIXEL Parsed Rows Before Filter', rows.length);

                if (transactFilter) {

                    var filteredRows = [];

                    for (var i = 0; i < rows.length; i++) {

                        var rowTransact = trimSafe(rows[i]['TRANSACT']);

                        if (rowTransact == transactFilter) {
                            filteredRows.push(rows[i]);
                        }
                    }

                    rows = filteredRows;

                    log.audit('PIXEL TRANSACT Filter Applied', {
                        transact: transactFilter,
                        rowsAfterFilter: rows.length
                    });

                } else {

                    log.audit('PIXEL TRANSACT Filter', 'Empty - processing all transactions');
                }


                // ----- Identify Pixel Orders Containing Discounts -----

                var discountTransacts = {};

                for (var i = 0; i < rows.length; i++) {

                    var rowTransact = trimSafe(rows[i]['TRANSACT']);
                    var prodType = trimSafe(rows[i]['prodtype']);

                    if (prodType == '100' && rowTransact) {

                        discountTransacts[rowTransact] = true;

                        log.debug('Discount Order Identified', {
                            transact: rowTransact,
                            prodType: prodType
                        });
                    }
                }

                // ----- Filter Negative Lines and Mark Discount Orders -----

                var processedRows = [];

                for (var i = 0; i < rows.length; i++) {

                    var row = rows[i];

                    var prodType = trimSafe(row['prodtype']);
                    var transact = trimSafe(row['TRANSACT']);
                    var amount = toNumber(row['Total_Including_Tax'], 0);

                    var prodTypeNumber = parseInt(prodType, 10);

                    // Ignore prodtype 101 completely
                    if (prodType == '101') {

                        log.debug('Prodtype 101 Ignored', {
                            transact: transact,
                            prodType: prodType,
                            amount: amount,
                            refCode: trimSafe(row['REFCODE']),
                            productName: trimSafe(row['Product_Name'])
                        });

                        continue;
                    }

                    // Ignore negative lines for prodtype 0 to 12
                    if (/^\d+$/.test(prodType) &&
                        prodTypeNumber >= 0 &&
                        prodTypeNumber <= 12 &&
                        amount < 0) {

                        log.debug('Negative Line Ignored', {
                            transact: transact,
                            prodType: prodType,
                            amount: amount,
                            refCode: trimSafe(row['REFCODE'])
                        });

                        continue;
                    }

                    // Mark discount lines
                    row['_pixelIsDiscountLine'] =
                        (prodType == '100');

                    // Mark all rows belonging to discounted Pixel orders
                    row['_pixelHasDiscount'] =
                        (discountTransacts[transact] == true);

                    processedRows.push(row);
                }

                rows = processedRows;

                // ----- Resolve Location, Brand and Payment Method For Grouping -----

                var locationCache = {};
                var paymentMethodCache = {};

                for (var i = 0; i < rows.length; i++) {

                    try {

                        var groupingSnum = trimSafe(rows[i]['SNUM']);

                        if (!groupingSnum) {
                            throw new Error(
                                'SNUM is missing for Pixel transaction "' +
                                trimSafe(rows[i]['TRANSACT']) + '".'
                            );
                        }

                        if (!locationCache[groupingSnum]) {

                            var groupingLocationData = findLocationByBranchId(groupingSnum);

                            if (!groupingLocationData || !groupingLocationData.locationId) {
                                throw new Error(
                                    'Branch "' + trimSafe(rows[i]['Branch']) +
                                    '" (SNUM: ' + groupingSnum +
                                    ') is not mapped to any Location in NetSuite.'
                                );
                            }

                            locationCache[groupingSnum] = {
                                locationId: String(groupingLocationData.locationId),
                                brandId: groupingLocationData.brandId
                                    ? String(groupingLocationData.brandId)
                                    : ''
                            };

                            log.debug('Grouping Location/Brand Resolved', {
                                snum: groupingSnum,
                                locationId: locationCache[groupingSnum].locationId,
                                brandId: locationCache[groupingSnum].brandId
                            });
                        }

                        rows[i]['_pixelLocationId'] =
                            locationCache[groupingSnum].locationId;

                        rows[i]['_pixelBrandId'] =
                            locationCache[groupingSnum].brandId;

                    } catch (groupingErr) {

                        log.error('Grouping Location/Brand Error', {
                            transact: trimSafe(rows[i]['TRANSACT']),
                            snum: trimSafe(rows[i]['SNUM']),
                            error: groupingErr.message || groupingErr
                        });

                        throw groupingErr;
                    }

                    // Payment method id, resolved once per distinct payment name.
                    // If it cannot be resolved here, reduce() falls back to its own lookup
                    // and reports the same error per group as before.
                    var rowPayment = trimSafe(rows[i]['Payment_Method']);

                    if (rowPayment) {

                        if (!paymentMethodCache.hasOwnProperty(rowPayment)) {

                            try {
                                paymentMethodCache[rowPayment] = findPaymentMethodId(rowPayment) || '';
                            } catch (pmErr) {
                                paymentMethodCache[rowPayment] = '';
                            }
                        }

                        rows[i]['_pixelPaymentMethodId'] = paymentMethodCache[rowPayment];
                    }
                }

                log.audit('PIXEL Rows After Filtering', {
                    totalRows: rows.length,
                    discountOrders: Object.keys(discountTransacts).length
                });

                if (rows.length == 0) {

                    log.audit('No Transactions Found', {
                        transact: transactFilter || 'ALL'
                    });

                    return [];
                }

                return rows;

            } catch (e) {

                createErrorLog('getInputData: ' + (e.message || e));
                throw e;
            }
        }


        function map(context) {

            try {

                var row = JSON.parse(context.value);

                var payment = trimSafe(row['Payment_Method']);
                var branch = trimSafe(row['Branch']);
                var hasDiscount = row['_pixelHasDiscount'] == true;


                var orderType = hasDiscount ? 'DISCOUNT' : 'NORMAL';

                var locationId = trimSafe(row['_pixelLocationId']);
                var brandId = trimSafe(row['_pixelBrandId']);

                var key = payment + '|' +
                    locationId + '|' +
                    brandId + '|' +
                    orderType + '|' +
                    'GROUP';

                log.debug('Pixel Order Grouping', {
                    transact: trimSafe(row['TRANSACT']),
                    payment: payment,
                    branch: branch,
                    orderType: orderType,
                    groupKey: key
                });

                context.write({
                    key: key,
                    value: row
                });

            } catch (e) {

                log.error('Map Error', {
                    error: e.message || e,
                    value: context.value
                });

                throw e;
            }
        }

        function reduce(context) {

            var parts = context.key.split('|');

            var payment = trimSafe(parts[0]);
            var locationId = trimSafe(parts[1]);
            var brandId = trimSafe(parts[2]);
            var orderType = trimSafe(parts[3]);

            var hasDiscount = (orderType == 'DISCOUNT');

            var soId = null;
            var lineCount = 0;
            var lineErrors = 0;
            var totalDiscount = 0;
            var expectedGross = 0;
            var snum = '';
            var branch = '';

            try {

                // ----- Parse every value ONCE -----

                var rows = [];

                for (var p = 0; p < context.values.length; p++) {
                    rows.push(JSON.parse(context.values[p]));
                }

                var firstRow = rows[0];

                snum = trimSafe(firstRow['SNUM']);
                branch = trimSafe(firstRow['Branch']);

                // ----- Single pass: combined discount + REFCODE validation + UPC list -----

                var upcList = [];
                var upcSeen = {};

                for (var v = 0; v < rows.length; v++) {

                    var vRow = rows[v];

                    if (vRow['_pixelIsDiscountLine'] == true) {

                        if (hasDiscount) {

                            var discountAmount = toNumber(vRow['Total_Excluding_Tax'], 0);

                            log.debug('Discount Amount Collected', {
                                transact: trimSafe(vRow['TRANSACT']),
                                prodType: vRow['prodtype'],
                                totalExcludingTax: discountAmount,
                                totalIncludingTax: vRow['Total_Including_Tax']
                            });

                            // API already provides discount as negative
                            totalDiscount += discountAmount;
                        }

                        // Discount lines are skipped from item validation and item lookup
                        continue;
                    }

                    var validationRefCode = trimSafe(vRow['REFCODE']);

                    if (!validationRefCode) {

                        var validationItemName = trimSafe(vRow['Product_Name']) || 'Unknown Item';

                        var validationErr = new Error(
                            'Sales Order stopped. REFCODE is empty. ' +
                            'Product: "' + validationItemName + '"' +
                            ' | Payment: "' + payment + '"' +
                            ' | Branch: "' + branch + '"' +
                            ' | SNUM: "' + snum + '"'
                        );

                        log.error('REFCODE Validation Error', validationErr);
                        throw validationErr;
                    }

                    if (!upcSeen[validationRefCode]) {
                        upcSeen[validationRefCode] = true;
                        upcList.push(validationRefCode);
                    }
                }

                if (hasDiscount) {

                    totalDiscount = Math.round(totalDiscount * 100) / 100;

                    log.debug('Combined Discount Calculated', {
                        payment: payment,
                        branch: branch,
                        totalDiscount: totalDiscount
                    });
                }

                log.debug('REFCODE Validation Passed', {
                    payment: payment,
                    branch: branch,
                    lineCount: rows.length
                });

                // ----- Validate header data BEFORE creating the record -----

                if (!payment) {
                    throw new Error('Payment Method is missing from source data.');
                }

                if (!locationId) {
                    throw new Error(
                        'Branch "' + branch + '" (SNUM: ' + snum + ') is not mapped to any Location in NetSuite.'
                    );
                }

                // Payment method id was resolved once in getInputData; fall back to a lookup if missing
                var paymentMethodId = trimSafe(firstRow['_pixelPaymentMethodId']);

                if (!paymentMethodId) {
                    paymentMethodId = findPaymentMethodId(payment);
                }

                if (!paymentMethodId) {
                    throw new Error(
                        'Payment Method "' + payment + '" was not found in NetSuite.'
                    );
                }

                // ----- Create Sales Order -----

                var so = record.create({
                    type: record.Type.SALES_ORDER,
                    isDynamic: true
                });

                so.setValue({ fieldId: 'customform', value: PIXEL_FORM_ID });
                so.setValue({ fieldId: PIXEL_SO_FLAG_FIELD, value: true });

                // ----- Set Transaction Date From API (OPENDATE) -----
                try {

                    var openDateRaw = trimSafe(firstRow['OPENDATE']);

                    if (openDateRaw) {

                        var formattedTranDate = convertApiDate(openDateRaw);

                        so.setText({ fieldId: 'trandate', text: formattedTranDate });

                    } else {
                        log.debug('OPENDATE Missing', 'Using system default date.');
                    }

                } catch (dateErr) {
                    log.error('Error Setting Transaction Date', dateErr);
                }

                // Set customer ONCE (also validates the payment -> customer mapping)
                try {
                    so.setText({ fieldId: 'entity', text: payment });
                } catch (entityErr) {
                    throw new Error(
                        'Payment Method "' + payment + '" is not mapped to any Customer in NetSuite.'
                    );
                }

                var paymentModeText = (payment.toLowerCase() == 'cash') ? 'Paid' : 'Credit';

                so.setValue({ fieldId: 'orderstatus', value: 'B' });
                so.setValue({ fieldId: 'custbody_ium_payment_method', value: Number(paymentMethodId) });
                so.setText({ fieldId: 'custbody_ium_payment_mode', text: paymentModeText });

                // Location / brand come from the group key (already resolved in getInputData)
                so.setValue({
                    fieldId: 'location',
                    value: Number(locationId)
                });

                if (brandId) {

                    so.setValue({
                        fieldId: 'class',
                        value: Number(brandId)
                    });

                    log.debug('Location Brand Applied', {
                        locationId: locationId,
                        brandId: brandId,
                        salesOrderField: 'class'
                    });

                } else {

                    log.debug('Location Brand Missing', {
                        locationId: locationId,
                        branch: branch,
                        snum: snum
                    });
                }

                // ----- Item lookup by UPC -----

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

                // ----- Item lines -----

                for (var k = 0; k < rows.length; k++) {

                    var row = rows[k];
                    var refCode = '';

                    try {

                        // Do not create discount lines as items
                        if (row['_pixelIsDiscountLine'] == true) {
                            continue;
                        }

                        refCode = trimSafe(row['REFCODE']);

                        var qty = toNumber(row['QUAN'], 0);

                        // Line tax amount comes directly from the API column Tax_Amount
                        var taxAmt = toNumber(row['Tax_Amount'], 0);
                        taxAmt = Math.round(taxAmt * 100) / 100;

                        var rawRate = toNumber(row['UNIT_PRICE'], 0);
                        var rate = rawRate < 0 ? 0 : rawRate;

                        // Line gross amount (incl. tax) comes directly from the API column Total_Including_Tax
                        var lineGross = toNumber(row['Total_Including_Tax'], 0);
                        lineGross = Math.round(lineGross * 100) / 100;

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

                        // 1) Item + Quantity
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: Number(itemId) });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: qty });

                        // 2) Rate (UNIT_PRICE, excluding tax)
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: rate });

                        // 3) Tax code first (it triggers a tax recalculation)
                        var taxCodeId = taxAmt > 0 ? TAX_CODE_TAXABLE_15 : TAX_CODE_NON_TAXABLE_0;

                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'taxcode', value: taxCodeId });

                        // 4) Line amount from API (Total_Including_Tax) -> Gross Amt column
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'grossamt', value: lineGross });

                        // 5) Tax amount from API (Tax_Amount) overrides the calculated tax
                        if (taxAmt > 0) {
                            so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'tax1amt', value: taxAmt });
                        }

                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: FLD_TXN_NO, value: trimSafe(row['TRANSACT']) });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: FLD_CASHIER, value: trimSafe(row['Cashier_Name']) });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: FLD_POS_ID, value: trimSafe(row['POS']) });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: FLD_UNIQUEID, value: trimSafe(row['UNIQUEID']) });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_ium_pstatus', value: 4 });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_ium_rec_pos_status_li', value: 4 });

                        so.commitLine({ sublistId: 'item' });

                        lineCount++;
                        expectedGross += lineGross;

                    } catch (lineErr) {

                        lineErrors++;

                        createErrorLog(
                            'Line Error → Payment: "' + payment +
                            '" | Branch: "' + branch +
                            '" | Item Code: "' + refCode +
                            '" | Details: ' + (lineErr.message || lineErr)
                        );
                    }
                }


                if (lineCount == 0) {
                    throw new Error('No valid lines to save for this Sales Order.');
                }

                // ----- Apply Combined Header Discount -----

                if (hasDiscount) {

                    if (totalDiscount < 0) {

                        so.setValue({
                            fieldId: 'discountitem',
                            value: 7480
                        });

                        so.setValue({
                            fieldId: 'discountrate',
                            value: totalDiscount
                        });

                        log.debug('Header Discount Applied', {
                            discountItem: 7480,
                            discountRate: totalDiscount,
                            payment: payment,
                            branch: branch
                        });

                    } else {

                        log.debug('No Negative Discount Amount', {
                            payment: payment,
                            branch: branch,
                            totalDiscount: totalDiscount
                        });
                    }
                }

                var totalAmount = so.getValue({
                    fieldId: 'total'
                });

                // Group-level sanity check (replaces the old per-line read-back).
                // Only meaningful when there is no header discount.
                if (!hasDiscount) {

                    expectedGross = Math.round(expectedGross * 100) / 100;

                    if (Math.abs(Number(totalAmount) - expectedGross) > 0.05) {
                        log.error('Pixel SO Total Mismatch', {
                            payment: payment,
                            branch: branch,
                            apiGrossTotal: expectedGross,
                            nsTotal: totalAmount,
                            lineCount: lineCount
                        });
                    }
                }

                so.selectNewLine({ sublistId: 'recmachcustrecord_ium_payment_so' });

                so.setCurrentSublistValue({ sublistId: 'recmachcustrecord_ium_payment_so', fieldId: 'custrecord_ium_payment_method', value: Number(paymentMethodId) });
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
                    '] :: ' + (e.message || e)
                );
            }
        }

        function parseCSV(csvText) {

            var rows = [];
            var i = 0, field = '', row = [], inQuotes = false;

            function pushField() { row.push(field); field = ''; }
            function pushRow() { rows.push(row); row = []; }

            while (i < csvText.length) {

                var c = csvText[i];

                if (inQuotes) {
                    if (c == '"') {
                        var next = csvText[i + 1];
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

            var header = rows[0].map(function (h) { return trimSafe(h); });

            // Normalize headers ONCE: work out which canonical alias (if any) each column maps to
            var headerAlias = header.map(function (h) {
                var norm = String(h).toLowerCase().replace(/[^a-z0-9]/g, '');
                var alias = HEADER_ALIASES[norm];
                return (alias && alias !== h) ? alias : null;
            });

            var data = [];

            for (var r = 1; r < rows.length; r++) {
                var obj = {};
                for (var col = 0; col < header.length; col++) {
                    var val = rows[r][col] != null ? String(rows[r][col]) : '';
                    obj[header[col]] = val;

                    if (headerAlias[col] && obj[headerAlias[col]] === undefined) {
                        obj[headerAlias[col]] = val;
                    }
                }
                data.push(obj);
            }

            return data;
        }

        function findPaymentMethodId(paymentName) {

            try {

                var paymentTrim = trimSafe(paymentName);

                if (!paymentTrim) {
                    return null;
                }

                log.debug('Searching Payment Method', {
                    apiPayment: paymentTrim
                });

                var paymentSearch = search.create({
                    type: 'paymentmethod',
                    filters: [
                        ['name', 'is', paymentTrim]
                    ],
                    columns: [
                        'internalid',
                        'name'
                    ]
                });

                var results = paymentSearch.run().getRange({
                    start: 0,
                    end: 100
                });

                for (var i = 0; i < results.length; i++) {

                    var name = trimSafe(results[i].getValue('name'));
                    var internalId = results[i].getValue('internalid');

                    if (name.toLowerCase() == paymentTrim.toLowerCase()) {

                        log.debug('Payment Method Found', {
                            apiPayment: paymentTrim,
                            netsuitePaymentMethod: name,
                            internalId: internalId
                        });

                        return internalId;
                    }
                }

                log.error('Payment Method Not Found', {
                    apiPayment: paymentTrim
                });

                return null;

            } catch (e) {

                log.error('Payment Method Search Error', {
                    payment: paymentName,
                    error: e.message || e
                });

                throw e;
            }
        }

        function findItemByUPC(upc) {

            var upcTrim = trimSafe(upc);
            if (!upcTrim) return null;

            var s = search.create({
                type: 'item',
                filters: [['upccode', 'is', upcTrim]],
                columns: ['internalid']
            });

            var res = s.run().getRange({ start: 0, end: 1 });

            if (res && res.length) {
                return res[0].getValue('internalid');
            }

            return null;
        }

        function findLocationByBranchId(branchId) {

            var branchTrim = trimSafe(branchId);

            if (!branchTrim) {
                return null;
            }

            try {

                var s = search.create({
                    type: 'location',
                    filters: [
                        ['custrecord_5826_loc_branch_id', 'is', branchTrim]
                    ],
                    columns: [
                        'internalid',
                        'custrecord_vs_location_brand'
                    ]
                });

                var res = s.run().getRange({
                    start: 0,
                    end: 1
                });

                if (res && res.length) {

                    var locationId = res[0].getValue({
                        name: 'internalid'
                    });

                    var brandId = res[0].getValue({
                        name: 'custrecord_vs_location_brand'
                    });

                    log.debug('Location Found', {
                        branch: branchTrim,
                        locationId: locationId,
                        brandId: brandId
                    });

                    return {
                        locationId: locationId,
                        brandId: brandId
                    };
                }

            } catch (e) {

                log.error('Location Search Error', {
                    branch: branchTrim,
                    error: e
                });

                throw e;
            }

            return null;
        }

        function nowDate() {
            return new Date();
        }

        function toNumber(x, fallback) {
            var n = parseFloat(String(x).replace(/,/g, ''));
            return isFinite(n) ? n : fallback;
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

        function createErrorLog(message) {

            try {

                var recId = record.create({
                    type: PIXEL_ERROR_REC
                }).setValue({
                    fieldId: PIXEL_ERR_DATE_FIELD,
                    value: nowDate()
                }).setValue({
                    fieldId: PIXEL_ERR_MSG_FIELD,
                    value: String(message).substring(0, 3999)
                }).save({
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                });

                log.error('PIXEL Error Logged', {
                    recId: recId,
                    message: message
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