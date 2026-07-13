/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/record', 'N/search', 'N/log'], (record, search, log) => {

    function onRequest(context) {
        if (context.request.method !== 'POST') {
            context.response.write(JSON.stringify({
                success: false,
                code: 'METHOD_NOT_ALLOWED',
                message: 'Use POST with JSON body.'
            }));
            return;
        }

        try {
            let body = JSON.parse(context.request.body);
            log.audit('Incoming Request', body);

            if (!body.transferOrderId) {
                throw new Error('transferOrderId is required.');
            }
            if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
                throw new Error('No lines provided.');
            }

            let requestMap = {};
            body.lines.forEach(line => {
                requestMap[line.sku] = line;
            });

            let ifRec = record.transform({
                fromType: record.Type.TRANSFER_ORDER,
                fromId: body.transferOrderId,
                toType: record.Type.ITEM_FULFILLMENT,
                isDynamic: true
            });

            ifRec.setValue({ fieldId: 'custbody_vs_shoof_transaction', value: true });

            let lineCount = ifRec.getLineCount({ sublistId: 'item' });

            for (let i = 0; i < lineCount; i++) {
                ifRec.selectLine({ sublistId: 'item', line: i });
                let currentItemId = ifRec.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item'
                });

                let currentSku = getSkuByItemId(currentItemId);
                let reqLine = requestMap[currentSku];

                if (!reqLine) {
                    ifRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: false });
                    ifRec.commitLine({ sublistId: 'item' });
                    continue;
                }

                let itemId = findItemBySKU(reqLine.sku);
                if (!itemId) {
                    throw new Error('Item not found for SKU: ' + reqLine.sku);
                }

                if (!Array.isArray(reqLine.lots) || reqLine.lots.length === 0) {
                    throw new Error('No lot details provided for SKU: ' + reqLine.sku);
                }

                let totalLotQty = reqLine.lots.reduce((sum, lot) => sum + parseFloat(lot.quantity || 0), 0);
                if (parseFloat(totalLotQty) !== parseFloat(reqLine.quantity)) {
                    throw new Error(`Total lot qty (${totalLotQty}) does not match line qty (${reqLine.quantity}) for SKU: ${reqLine.sku}`);
                }

                ifRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: true });
                ifRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: reqLine.quantity });

                let invDetail = ifRec.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });

                reqLine.lots.forEach(lot => {
                    let lotId = findLotId(itemId, lot.lotNumber);
                    if (!lotId) {
                        throw new Error(`Lot not found for SKU ${reqLine.sku}, Lot: ${lot.lotNumber}`);
                    }

                    invDetail.selectNewLine({ sublistId: 'inventoryassignment' });
                    invDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: lotId });
                    invDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: lot.quantity });
                    invDetail.commitLine({ sublistId: 'inventoryassignment' });
                });

                ifRec.commitLine({ sublistId: 'item' });
            }

            let ifId = ifRec.save({ enableSourcing: true, ignoreMandatoryFields: false });

            context.response.write(JSON.stringify({
                success: true,
                message: 'Item Fulfillment created successfully.',
                id: ifId
            }));

        } catch (e) {
            log.error('ERROR', e);
            context.response.write(JSON.stringify({
                success: false,
                message: e.message || e.toString()
            }));
        }
    }

    function findItemBySKU(sku) {
        let itemSearch = search.create({
            type: search.Type.ITEM,
            filters: [['custitem_vs_sku', 'is', sku]],
            columns: ['internalid']
        }).run().getRange({ start: 0, end: 1 });

        if (itemSearch && itemSearch.length > 0) {
            return itemSearch[0].getValue('internalid');
        }
        return null;
    }

    function getSkuByItemId(itemId) {
        let itemSearch = search.create({
            type: search.Type.ITEM,
            filters: [['internalid', 'anyof', itemId]],
            columns: ['custitem_vs_sku']
        }).run().getRange({ start: 0, end: 1 });

        if (itemSearch && itemSearch.length > 0) {
            return itemSearch[0].getValue('custitem_vs_sku');
        }
        return null;
    }

    function findLotId(itemId, lotNumber) {
        let lotSearch = search.create({
            type: 'inventorynumber',
            filters: [
                ['inventorynumber', 'is', lotNumber],
                'AND', ['item', 'anyof', itemId]
            ],
            columns: ['internalid']
        }).run().getRange({ start: 0, end: 1 });

        if (lotSearch && lotSearch.length > 0) {
            return lotSearch[0].getValue('internalid');
        }
        return null;
    }

    return { onRequest };
});
