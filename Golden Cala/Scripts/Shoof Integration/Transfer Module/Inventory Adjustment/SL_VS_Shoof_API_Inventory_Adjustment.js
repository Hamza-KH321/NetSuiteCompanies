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

                if (!Object.prototype.hasOwnProperty.call(line, 'lots')) {
                    throw new Error(
                        'Lots must be provided for SKU: ' + line.sku +
                        '. If no lot is required, send lotNumber as empty and quantity as 0.'
                    );
                }

                if (!Array.isArray(line.lots)) {
                    throw new Error(
                        'lots must be an array for SKU: ' + line.sku
                    );
                }

                var hasLot = false;
                var totalLotQty = 0;

                for (var l = 0; l < line.lots.length; l++) {

                    var lot = line.lots[l];

                    if (!lot.lotNumber || String(lot.lotNumber).trim() == '') {
                        continue;
                    }

                    if (!isFinite(parseFloat(lot.quantity)) || parseFloat(lot.quantity) <= 0) {
                        throw new Error(
                            'Lot quantity must be greater than 0 for SKU: ' + line.sku
                        );
                    }

                    hasLot = true;
                    totalLotQty += parseFloat(lot.quantity);
                }

                if (hasLot && parseFloat(totalLotQty) != parseFloat(line.quantity)) {
                    throw new Error(
                        'Total lot qty (' + totalLotQty +
                        ') does not match line qty (' + line.quantity +
                        ') for SKU: ' + line.sku
                    );
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

                if (hasLot) {

                    var invDetail = adjRec.getCurrentSublistSubrecord({
                        sublistId: 'inventory',
                        fieldId: 'inventorydetail'
                    });

                    for (var m = 0; m < line.lots.length; m++) {

                        var lotAssignment = line.lots[m];

                        if (!lotAssignment.lotNumber ||
                            String(lotAssignment.lotNumber).trim() == '') {
                            continue;
                        }

                        invDetail.selectNewLine({
                            sublistId: 'inventoryassignment'
                        });

                        invDetail.setCurrentSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'receiptinventorynumber',
                            value: String(lotAssignment.lotNumber)
                        });

                        invDetail.setCurrentSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'quantity',
                            value: parseFloat(lotAssignment.quantity)
                        });

                        invDetail.commitLine({
                            sublistId: 'inventoryassignment'
                        });

                        log.debug('Inventory Assignment Added', {
                            sku: line.sku,
                            lotNumber: lotAssignment.lotNumber,
                            quantity: lotAssignment.quantity
                        });
                    }

                } else {

                    log.debug('Inventory Assignment Skipped', {
                        sku: line.sku,
                        reason: 'No lot number provided'
                    });
                }

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
