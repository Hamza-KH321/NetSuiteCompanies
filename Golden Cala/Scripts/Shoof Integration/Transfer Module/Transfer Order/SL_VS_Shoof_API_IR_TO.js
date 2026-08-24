/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API IR TO
 */
define(['N/record', 'N/log', 'N/search'], (record, log, search) => {

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
            let body = JSON.parse(context.request.body || '{}');
            log.audit('Incoming Request', body);

            if (!body.transferOrderId) {
                throw new Error('transferOrderId is required.');
            }
            if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
                throw new Error('items array is required.');
            }

            let skuToIdMap = {};
            body.items.forEach(it => {
                if (!it.id) throw new Error('Each item must have id (custitem_vs_sku).');
                let itemId = findItemInternalIdBySku(it.id);
                if (!itemId) {
                    throw new Error(`Item with SKU ${it.id} not found.`);
                }
                skuToIdMap[itemId] = parseFloat(it.quantity) || 0;
            });

            let irRec = record.transform({
                fromType: record.Type.TRANSFER_ORDER,
                fromId: body.transferOrderId,
                toType: record.Type.ITEM_RECEIPT,
                isDynamic: true
            });

            irRec.setValue({ fieldId: 'custbody_vs_shoof_transaction', value: true });

            let lineCount = irRec.getLineCount({ sublistId: 'item' });
            for (let i = 0; i < lineCount; i++) {
                irRec.selectLine({ sublistId: 'item', line: i });
                let lineItemId = irRec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' });

                if (skuToIdMap[lineItemId] !== undefined) {
                    irRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: true });
                    irRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: skuToIdMap[lineItemId] });
                } else {
                    irRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: false });
                }

                irRec.commitLine({ sublistId: 'item' });
            }

            let irId = irRec.save({ enableSourcing: true, ignoreMandatoryFields: false });

            context.response.write(JSON.stringify({
                success: true,
                message: 'Item Receipt created successfully.',
                id: irId
            }));

        } catch (e) {
            log.error('ERROR', e);
            context.response.write(JSON.stringify({
                success: false,
                message: e.message || e.toString()
            }));
        }
    }

    function findItemInternalIdBySku(sku) {
        let itemSearch = search.create({
            type: search.Type.ITEM,
            filters: [['custitem_vs_sku', 'is', sku]],
            columns: ['internalid']
        });

        let result = itemSearch.run().getRange({ start: 0, end: 1 });
        if (result && result.length > 0) {
            return result[0].getValue('internalid');
        }
        return null;
    }

    return { onRequest };
});
