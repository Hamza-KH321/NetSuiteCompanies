/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || VDC Item SOH
 */
define(['N/search', 'N/ui/serverWidget', 'N/log'], function(search, serverWidget, log) {

    var CONFIG = {
        PAGE_SIZE: 1000,
        FORM_TITLE: 'Item Receipt vs Invoice Comparison',
        VDC_FALLBACK: {
            '1': 'Abha',
            '2': 'Eastern'
        }
    };

    function getItemReceiptSearch() {
        return search.create({
            type: 'itemreceipt',
            settings: [{ name: 'consolidationtype', value: 'ACCTTYPE' }],
            filters: [
                ['type', 'anyof', 'ItemRcpt'],
                'AND',
                ['mainline', 'is', 'F'],
                'AND',
                ['custbody24', 'anyof', '2', '1'],
                'AND',
                ['item.custitem36', 'is', 'T']
            ],
            columns: [
                search.createColumn({ name: 'item', summary: 'GROUP', label: 'Item' }),
                search.createColumn({ name: 'custbody24', summary: 'GROUP', label: 'VDC' }),
                search.createColumn({ name: 'inventorynumber', join: 'inventoryDetail', summary: 'GROUP', label: 'Number' }),
                search.createColumn({ name: 'quantity', summary: 'SUM', label: 'Quantity' })
            ]
        });
    }

    function getInvoiceSearch() {
        return search.create({
            type: 'invoice',
            settings: [{ name: 'consolidationtype', value: 'ACCTTYPE' }],
            filters: [
                ['mainline', 'is', 'F'],
                'AND',
                ['custbody24', 'anyof', '1', '2'],
                'AND',
                ['item.custitem36', 'is', 'T'],
                'AND',
                ['type', 'anyof', 'CustInvc']
            ],
            columns: [
                search.createColumn({ name: 'item', summary: 'GROUP', label: 'Item' }),
                search.createColumn({ name: 'custbody24', summary: 'GROUP', label: 'VDC' }),
                search.createColumn({ name: 'inventorynumber', join: 'inventoryDetail', summary: 'GROUP', label: 'Number' }),
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
                    var invNumText = result.getText({ name: 'inventorynumber', join: 'inventoryDetail', summary: 'GROUP' });
                    var invNumValue = result.getValue({ name: 'inventorynumber', join: 'inventoryDetail', summary: 'GROUP' });
                    var invNum = invNumText || invNumValue || '';
                    var qty = parseFloat(result.getValue({ name: 'quantity', summary: 'SUM' })) || 0;

                    rows.push({
                        itemId: itemId,
                        itemText: itemText,
                        vdcId: vdcId,
                        vdcText: vdcText,
                        invNum: invNum,
                        qty: qty
                    });
                });
            });
        } catch (e) {
            log.error({ title: 'runSummarySearch error', details: e });
        }
        return rows;
    }

    function buildKey(itemId, vdcId, invNum) {
        return itemId + '::' + vdcId + '::' + (invNum || 'NONE');
    }

    function mergeResults(receiptRows, invoiceRows) {
        var map = {};

        receiptRows.forEach(function(r) {
            var key = buildKey(r.itemId, r.vdcId, r.invNum);
            if (!map[key]) {
                map[key] = {
                    itemText: r.itemText,
                    vdcText: r.vdcText,
                    invNum: r.invNum,
                    received: 0,
                    fulfilled: 0
                };
            }
            map[key].received += r.qty;
        });

        invoiceRows.forEach(function(r) {
            var key = buildKey(r.itemId, r.vdcId, r.invNum);
            if (!map[key]) {
                map[key] = {
                    itemText: r.itemText,
                    vdcText: r.vdcText,
                    invNum: r.invNum,
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
                merged.push({
                    itemText: entry.itemText,
                    vdcText: entry.vdcText,
                    invNum: entry.invNum,
                    received: entry.received,
                    fulfilled: entry.fulfilled,
                    total: entry.received - entry.fulfilled
                });
            }
        }

        merged.sort(function(a, b) {
            if (a.itemText !== b.itemText) {
                return a.itemText < b.itemText ? -1 : 1;
            }
            if (a.vdcText !== b.vdcText) {
                return a.vdcText < b.vdcText ? -1 : 1;
            }
            return a.invNum < b.invNum ? -1 : (a.invNum > b.invNum ? 1 : 0);
        });

        return merged;
    }

    function buildList(rows) {
        var list = serverWidget.createList({ title: CONFIG.FORM_TITLE });

        list.addColumn({ id: 'item', type: serverWidget.FieldType.TEXT, label: 'Item' });
        list.addColumn({ id: 'vdc', type: serverWidget.FieldType.TEXT, label: 'VDC' });
        list.addColumn({ id: 'invnum', type: serverWidget.FieldType.TEXT, label: 'Inventory Number' });
        list.addColumn({ id: 'received', type: serverWidget.FieldType.TEXT, label: 'Received Qty' });
        list.addColumn({ id: 'fulfilled', type: serverWidget.FieldType.TEXT, label: 'Fulfilled Qty' });
        list.addColumn({ id: 'total', type: serverWidget.FieldType.TEXT, label: 'Total (Rec - Ful)' });

        rows.forEach(function(row) {
            list.addRow({
                row: {
                    item: row.itemText,
                    vdc: row.vdcText,
                    invnum: row.invNum,
                    received: String(row.received),
                    fulfilled: String(row.fulfilled),
                    total: String(row.total)
                }
            });
        });

        return list;
    }

    function onRequest(context) {
        try {
            if (context.request.method === 'GET') {
                var receiptRows = runSummarySearch(getItemReceiptSearch());
                var invoiceRows = runSummarySearch(getInvoiceSearch());
                var mergedRows = mergeResults(receiptRows, invoiceRows);
                var list = buildList(mergedRows);

                context.response.writePage(list);
            }
        } catch (e) {
            log.error({ title: 'onRequest error', details: e });
            context.response.write({ output: 'An error occurred: ' + e.message });
        }
    }

    return {
        onRequest: onRequest
    };
});