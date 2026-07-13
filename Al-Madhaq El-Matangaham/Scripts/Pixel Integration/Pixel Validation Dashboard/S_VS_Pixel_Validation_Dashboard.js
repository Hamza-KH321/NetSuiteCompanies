/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Pixel Validation Dashboard
 */
define(['N/ui/serverWidget', 'N/file', 'N/https', 'N/search', 'N/log', 'N/format', 'N/runtime'],
    function (serverWidget, file, https, search, log, format, runtime) {


        const HTML_PATH = 'SuiteScripts/Pixel Integration/Pixel_Validation.html';

        function onRequest(context) {

            try {

                log.audit('Pixel Validation', 'Request Method: ' + context.request.method);

                if (context.request.method == 'GET') {

                    renderPage(context);
                    return;
                }

                var action = context.request.parameters.action || '';

                log.audit('Pixel Validation Action', action);

                if (action == 'validate') {

                    validateData(context);
                    return;
                }

                context.response.write(JSON.stringify({
                    success: false,
                    message: 'Invalid action.'
                }));

            } catch (e) {

                log.error('onRequest Error', e);

                context.response.write(JSON.stringify({
                    success: false,
                    message: e.message || e
                }));
            }
        }

        function renderPage(context) {

            try {

                var form = serverWidget.createForm({
                    title: 'Pixel Validation Dashboard'
                });

                var htmlField = form.addField({
                    id: 'custpage_html',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'HTML'
                });

                var htmlContent = file.load({
                    id: 6479
                }).getContents();

                var suiteletUrl =
                    '/app/site/hosting/scriptlet.nl?script=' +
                    runtime.getCurrentScript().id +
                    '&deploy=' +
                    runtime.getCurrentScript().deploymentId;

                htmlContent = htmlContent.replace(
                    '##SUITELET_URL##',
                    suiteletUrl
                );

                htmlField.defaultValue = htmlContent;

                context.response.writePage(form);

            } catch (e) {

                log.error('renderPage Error', e);
                throw e;
            }
        }

        function validateData(context) {

            try {

                var fromDate = context.request.parameters.fromDate || '';
                var toDate = context.request.parameters.toDate || '';

                log.audit('Request Parameters', JSON.stringify(context.request.parameters));
                log.audit('From Date', fromDate);
                log.audit('To Date', toDate);

                if (!fromDate || !toDate) {

                    context.response.write(JSON.stringify({
                        success: false,
                        message: 'From Date and To Date are required.'
                    }));

                    return;
                }

                var apiUrl =
                    'https://eoi.wecreatives.agency/api/HQEOI/DownloadSalesReport' +
                    '?fromDate=' + encodeURIComponent(fromDate) +
                    '&toDate=' + encodeURIComponent(toDate);

                log.audit('API URL', apiUrl);

                var response = https.get({
                    url: apiUrl
                });

                if (response.code < 200 || response.code >= 300) {

                    throw new Error(
                        'API call failed. HTTP Code: ' + response.code
                    );
                }

                var csvText = response.body || '';

                var apiRows = parseCSV(csvText);

                log.audit('API Rows', apiRows.length);

                var itemCache = buildItemCache();
                var customerCache = buildCustomerCache();
                var locationCache = buildLocationCache();

                log.audit('Item Cache', Object.keys(itemCache).length);
                log.audit('Customer Cache', Object.keys(customerCache).length);
                log.audit('Location Cache', Object.keys(locationCache).length);

                var missingItems = [];
                var missingCustomers = [];
                var missingLocations = [];

                var missingItemMap = {};
                var missingCustomerMap = {};
                var missingLocationMap = {};

                for (var i = 0; i < apiRows.length; i++) {

                    try {

                        var row = apiRows[i];

                        var refCode = trimSafe(row.REFCODE);
                        var paymentMethod = trimSafe(row.Payment_Method);
                        var branchId = trimSafe(row.SNUM);

                        var productName = trimSafe(row.Product_Name);
                        var transactionNo = trimSafe(row.TRANSACT);
                        var branchName = trimSafe(row.Branch);
                        var openDate = trimSafe(row.OPENDATE);

                        try {

                            var itemKey = refCode;

                            if (!refCode) {
                                itemKey = 'NO_UPC_' + productName.toUpperCase();
                            }

                            if (!refCode || !itemCache[refCode]) {

                                if (!missingItemMap[itemKey]) {

                                    missingItemMap[itemKey] = true;

                                    missingItems.push({
                                        upc: refCode || '',
                                        productName: productName,
                                        transactionNo: transactionNo,
                                        branchName: branchName,
                                        openDate: openDate
                                    });
                                }
                            }

                        } catch (itemError) {

                            log.error('Item Validation Error', itemError);
                        }

                        if (paymentMethod) {

                            var customerKey = paymentMethod.toUpperCase();

                            if (!customerCache[customerKey]) {

                                if (!missingCustomerMap[customerKey]) {

                                    missingCustomerMap[customerKey] = true;

                                    missingCustomers.push({
                                        paymentMethod: paymentMethod,
                                        branchName: branchName,
                                        openDate: openDate
                                    });
                                }
                            }
                        }

                        if (branchId) {

                            if (!locationCache[branchId]) {

                                if (!missingLocationMap[branchId]) {

                                    missingLocationMap[branchId] = true;

                                    missingLocations.push({
                                        branchId: branchId,
                                        branchName: branchName,
                                        openDate: openDate
                                    });
                                }
                            }
                        }

                    } catch (rowError) {

                        log.error('Row Validation Error', rowError);
                    }
                }

                var result = {
                    success: true,
                    summary: {
                        totalRecords: apiRows.length,
                        missingItems: missingItems.length,
                        missingCustomers: missingCustomers.length,
                        missingLocations: missingLocations.length
                    },
                    missingItems: missingItems,
                    missingCustomers: missingCustomers,
                    missingLocations: missingLocations
                };

                context.response.setHeader({
                    name: 'Content-Type',
                    value: 'application/json'
                });

                context.response.write(JSON.stringify(result));

            } catch (e) {

                log.error('validateData Error', e);

                context.response.write(JSON.stringify({
                    success: false,
                    message: e.message || e
                }));
            }
        }

        function buildItemCache() {

            var cache = {};

            try {

                var itemSearchObj = search.create({
                    type: "item",
                    filters: [],
                    columns: [
                        search.createColumn({
                            name: "itemid"
                        }),
                        search.createColumn({
                            name: "internalid"
                        }),
                        search.createColumn({
                            name: "upccode"
                        })
                    ]
                });

                var pagedData = itemSearchObj.runPaged({
                    pageSize: 1000
                });

                pagedData.pageRanges.forEach(function (pageRange) {

                    var page = pagedData.fetch({
                        index: pageRange.index
                    });

                    page.data.forEach(function (result) {

                        var upc = trimSafe(
                            result.getValue('upccode')
                        );

                        if (upc) {

                            cache[upc] = {
                                internalid: result.getValue('internalid'),
                                itemid: result.getValue('itemid')
                            };
                        }
                    });
                });

            } catch (e) {

                log.error('buildItemCache Error', e);
            }

            return cache;
        }

        function buildCustomerCache() {

            var cache = {};

            try {

                var customerSearchObj = search.create({
                    type: "customer",
                    filters: [],
                    columns: [
                        search.createColumn({
                            name: "entityid"
                        }),
                        search.createColumn({
                            name: "internalid"
                        })
                    ]
                });

                var pagedData = customerSearchObj.runPaged({
                    pageSize: 1000
                });

                pagedData.pageRanges.forEach(function (pageRange) {

                    var page = pagedData.fetch({
                        index: pageRange.index
                    });

                    page.data.forEach(function (result) {

                        var entityId = trimSafe(
                            result.getValue('entityid')
                        ).toUpperCase();

                        if (entityId) {

                            cache[entityId] = result.getValue('internalid');
                        }
                    });
                });

            } catch (e) {

                log.error('buildCustomerCache Error', e);
            }

            return cache;
        }

        function buildLocationCache() {

            var cache = {};

            try {

                var locationSearchObj = search.create({
                    type: "location",
                    filters: [
                        ["custrecord_5826_loc_branch_id", "isnotempty", ""]
                    ],
                    columns: [
                        search.createColumn({
                            name: "formulatext",
                            formula: "SUBSTR({name}, INSTR({name}, ':') + 1)"
                        }),
                        search.createColumn({
                            name: "internalid"
                        }),
                        search.createColumn({
                            name: "custrecord_5826_loc_branch_id"
                        })
                    ]
                });

                var pagedData = locationSearchObj.runPaged({
                    pageSize: 1000
                });

                pagedData.pageRanges.forEach(function (pageRange) {

                    var page = pagedData.fetch({
                        index: pageRange.index
                    });

                    page.data.forEach(function (result) {

                        var branchId = trimSafe(
                            result.getValue('custrecord_5826_loc_branch_id')
                        );

                        if (branchId) {

                            cache[branchId] = {
                                internalid: result.getValue('internalid')
                            };
                        }
                    });
                });

            } catch (e) {

                log.error('buildLocationCache Error', e);
            }

            return cache;
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

                if (
                    row.length > 1 ||
                    (row.length == 1 && row[0] != '')
                ) {
                    pushRow();
                }

                if (rows.length == 0) {
                    return [];
                }

                var headers = rows[0];
                var data = [];

                for (var r = 1; r < rows.length; r++) {

                    var obj = {};

                    for (var c = 0; c < headers.length; c++) {

                        obj[trimSafe(headers[c])] =
                            rows[r][c] != null
                                ? String(rows[r][c])
                                : '';
                    }

                    data.push(obj);
                }

                return data;

            } catch (e) {

                log.error('parseCSV Error', e);
                return [];
            }
        }

        function trimSafe(value) {

            return value == null
                ? ''
                : String(value).trim();
        }

        return {
            onRequest: onRequest
        };

    });