/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || VDC Item SOH API
 */
define(['N/search', 'N/log'], function(search, log) {

    var CONFIG = {
        PAGE_SIZE: 1000,
        DATE_PARAM: 'fromDate',
        VDC_FALLBACK: {
            '1': 'Abha',
            '2': 'Eastern'
        }
    };

    function getItemReceiptSearch(fromDate) {
        var filters = [
            ['type', 'anyof', 'ItemRcpt'],
            'AND',
            ['mainline', 'is', 'F'],
            'AND',
            ['custbody24', 'anyof', '2', '1'],
            'AND',
            ['item.custitem36', 'is', 'T'],
            'AND',
            ['trandate', 'onorafter', fromDate]
        ];

        return search.create({
            type: 'itemreceipt',
            settings: [{ name: 'consolidationtype', value: 'ACCTTYPE' }],
            filters: filters,
            columns: [
                search.createColumn({ name: 'item', summary: 'GROUP', label: 'Item' }),
                search.createColumn({ name: 'custbody24', summary: 'GROUP', label: 'VDC' }),
                search.createColumn({ name: 'quantity', summary: 'SUM', label: 'Quantity' })
            ]
        });
    }

    function getInvoiceSearch(fromDate) {
        var filters = [
            ['mainline', 'is', 'F'],
            'AND',
            ['custbody24', 'anyof', '1', '2'],
            'AND',
            ['item.custitem36', 'is', 'T'],
            'AND',
            ['type', 'anyof', 'CustInvc'],
            'AND',
            ['trandate', 'onorafter', fromDate]
        ];

        return search.create({
            type: 'invoice',
            settings: [{ name: 'consolidationtype', value: 'ACCTTYPE' }],
            filters: filters,
            columns: [
                search.createColumn({ name: 'item', summary: 'GROUP', label: 'Item' }),
                search.createColumn({ name: 'custbody24', summary: 'GROUP', label: 'VDC' }),
                search.createColumn({ name: 'quantity', summary: 'SUM', label: 'Quantity' })
            ]
        });
    }

    function runSummarySearch(searchObj) {
        var rows = [];
        try {
            var pagedData = searchObj.runPaged({ pageSize: CONFIG.PAGE_SIZE });
            pagedData.pageRanges.forEach(function(pageRange) {
                var page = pagedData.fetch({ index: pageRange.index });
                page.data.forEach(function(result) {
                    var itemId = result.getValue({ name: 'item', summary: 'GROUP' });
                    var itemText = result.getText({ name: 'item', summary: 'GROUP' });
                    var vdcId = result.getValue({ name: 'custbody24', summary: 'GROUP' });
                    var vdcText = result.getText({ name: 'custbody24', summary: 'GROUP' }) || CONFIG.VDC_FALLBACK[vdcId] || vdcId;
                    var qty = parseFloat(result.getValue({ name: 'quantity', summary: 'SUM' })) || 0;

                    rows.push({
                        itemId: itemId,
                        itemText: itemText,
                        vdcId: vdcId,
                        vdcText: vdcText,
                        qty: qty
                    });
                });
            });
        } catch (e) {
            log.error({ title: 'runSummarySearch error', details: e });
        }
        return rows;
    }

    function buildKey(itemId, vdcId) {
        return itemId + '::' + vdcId;
    }

    function mergeResults(receiptRows, invoiceRows) {
        var map = {};

        receiptRows.forEach(function(r) {
            var key = buildKey(r.itemId, r.vdcId);
            if (!map[key]) {
                map[key] = {
                    itemId: r.itemId,
                    itemText: r.itemText,
                    vdcId: r.vdcId,
                    vdcText: r.vdcText,
                    received: 0,
                    fulfilled: 0
                };
            }
            map[key].received += r.qty;
        });

        invoiceRows.forEach(function(r) {
            var key = buildKey(r.itemId, r.vdcId);
            if (!map[key]) {
                map[key] = {
                    itemId: r.itemId,
                    itemText: r.itemText,
                    vdcId: r.vdcId,
                    vdcText: r.vdcText,
                    received: 0,
                    fulfilled: 0
                };
            }
            map[key].fulfilled += r.qty;
        });

        var merged = [];
        for (var key in map) {
            if (map.hasOwnProperty(key)) {
                var entry = map[key];
                var rawTotal = entry.received - entry.fulfilled;
                merged.push({
                    itemId: entry.itemId,
                    item: entry.itemText,
                    vdcId: entry.vdcId,
                    vdc: entry.vdcText,
                    received: entry.received,
                    fulfilled: entry.fulfilled,
                    total: rawTotal < 0 ? 0 : rawTotal
                });
            }
        }

        merged.sort(function(a, b) {
            if (a.item !== b.item) {
                return a.item < b.item ? -1 : 1;
            }
            return a.vdc < b.vdc ? -1 : (a.vdc > b.vdc ? 1 : 0);
        });

        return merged;
    }

    function getComparisonData(fromDate) {
        if (!fromDate) {
            return {
                success: false,
                error: 'Missing required parameter: ' + CONFIG.DATE_PARAM + ' (expected format MM/DD/YYYY).'
            };
        }

        try {
            var receiptRows = runSummarySearch(getItemReceiptSearch(fromDate));
            var invoiceRows = runSummarySearch(getInvoiceSearch(fromDate));
            var mergedRows = mergeResults(receiptRows, invoiceRows);

            return {
                success: true,
                fromDate: fromDate,
                count: mergedRows.length,
                results: mergedRows
            };
        } catch (e) {
            log.error({ title: 'getComparisonData error', details: e });
            return {
                success: false,
                error: e.message
            };
        }
    }

    function onRequest(context) {
        var fromDate = '';
        var responseBody = {};

        try {
            if (context.request.method === 'GET') {
                fromDate = context.request.parameters[CONFIG.DATE_PARAM];
            } else if (context.request.method === 'POST') {
                var body = {};
                try {
                    body = JSON.parse(context.request.body || '{}');
                } catch (parseError) {
                    body = context.request.parameters;
                }
                fromDate = body[CONFIG.DATE_PARAM];
            }

            responseBody = getComparisonData(fromDate);
        } catch (e) {
            log.error({ title: 'onRequest error', details: e });
            responseBody = {
                success: false,
                error: e.message
            };
        }

        context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
        context.response.write({ output: JSON.stringify(responseBody) });
    }

    return {
        onRequest: onRequest
    };
});
