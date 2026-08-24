/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API Inventory Adjustment
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

            let adjRec = record.create({ type: record.Type.INVENTORY_ADJUSTMENT, isDynamic: true });

            adjRec.setValue({ fieldId: 'customform', value: 173 }); // Shoof Inventory Adjustment
            adjRec.setValue({ fieldId: 'subsidiary', value: 2 });
            adjRec.setValue({ fieldId: 'custbody_vs_shoof_transaction', value: true });
            adjRec.setValue({ fieldId: 'account', value: 350 });

            if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
                throw new Error('No lines provided.');
            }

            body.lines.forEach(line => {
                let itemId = findItemBySKU(line.sku);
                if (!itemId) {
                    throw new Error('Item not found for SKU: ' + line.sku);
                }

                if (!Array.isArray(line.lots) || line.lots.length === 0) {
                    throw new Error('No lot details provided for SKU: ' + line.sku);
                }

                let totalLotQty = line.lots.reduce((sum, lot) => sum + parseFloat(lot.quantity || 0), 0);
                if (parseFloat(totalLotQty) !== parseFloat(line.quantity)) {
                    throw new Error(`Total lot qty (${totalLotQty}) does not match line qty (${line.quantity}) for SKU: ${line.sku}`);
                }

                adjRec.selectNewLine({ sublistId: 'inventory' });
                adjRec.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'item', value: itemId });
                adjRec.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'location', value: line.location });
                adjRec.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'adjustqtyby', value: line.quantity });

                let currentCost = adjRec.getCurrentSublistValue({ sublistId: 'inventory', fieldId: 'unitcost' });

                if ((currentCost === null || parseFloat(currentCost) === 0) &&
                    line.unitcost && parseFloat(line.unitcost) > 0) {
                    adjRec.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'unitcost', value: parseFloat(line.unitcost) });
                }

                let invDetail = adjRec.getCurrentSublistSubrecord({ sublistId: 'inventory', fieldId: 'inventorydetail' });

                line.lots.forEach(lot => {
                    invDetail.selectNewLine({ sublistId: 'inventoryassignment' });
                    invDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'receiptinventorynumber', value: lot.lotNumber });
                    invDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: lot.quantity });
                    invDetail.commitLine({ sublistId: 'inventoryassignment' });
                });

                adjRec.commitLine({ sublistId: 'inventory' });
            });

            let adjId = adjRec.save({ enableSourcing: true, ignoreMandatoryFields: false });

            context.response.write(JSON.stringify({
                success: true,
                message: 'Inventory Adjustment created successfully.',
                id: adjId
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

    return { onRequest };
});
