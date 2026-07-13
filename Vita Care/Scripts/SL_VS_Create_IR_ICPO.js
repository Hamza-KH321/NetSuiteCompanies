/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/record', 'N/search', 'N/redirect', 'N/log'], function (record, search, redirect, log) {

    function onRequest(context) {
        if (context.request.method !== 'GET') {
            context.response.write('Use GET.');
            return;
        }

        var poId = context.request.parameters.poId;
        if (!poId) {
            context.response.write('Missing poId.');
            return;
        }

        try {
            var po = record.load({ type: record.Type.PURCHASE_ORDER, id: poId, isDynamic: false });
            var poSubsidiary = po.getValue('subsidiary');
            var poLocation   = po.getValue('location');
            var intercoSoId  = po.getValue('intercotransaction');
            if (!intercoSoId) {
                context.response.write('This PO has no intercotransaction (SO).');
                return;
            }

            // Build shipped / already received / remaining
            var shipped   = getIFShippedByItemSerial(intercoSoId); // {itemId:{serial:qty}}
            log.debug('IF shipped (by item/serial)', shipped);

            var already   = getIRReceivedByItemSerial(poId);       // {itemId:{serial:qty}}
            log.debug('IR already received (by item/serial)', already);

            var remaining = buildRemaining(shipped, already);      // {itemId:[{serial,quantity}]}
            log.debug('Remaining (by item -> list of serial/qty)', remaining);

            // Transform PO -> IR
            var ir = record.transform({
                fromType: record.Type.PURCHASE_ORDER,
                fromId: poId,
                toType: record.Type.ITEM_RECEIPT,
                isDynamic: true
            });
            if (poSubsidiary) ir.setValue({ fieldId: 'subsidiary', value: poSubsidiary });
            if (poLocation)   ir.setValue({ fieldId: 'location',   value: poLocation });

            // Pass 1: uncheck non-receive lines (no remaining)
            var count = ir.getLineCount({ sublistId: 'item' });
            for (var i = 0; i < count; i++) {
                ir.selectLine({ sublistId: 'item', line: i });
                var itemIdAtI = ir.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' });
                var remList   = remaining[itemIdAtI] || [];
                if (sum(remList) <= 0) {
                    ir.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: false });
                    log.debug('Unchecked IR line (no remaining)', { line: i, itemId: itemIdAtI });
                }
                ir.commitLine({ sublistId: 'item' });
            }

            // Pass 2: assign inventory details WITH strict quantity checks
            count = ir.getLineCount({ sublistId: 'item' });

            // Collect summary of what we assign
            var finalSummary = []; // [{line,itemId,itemText,quantity,assignments:[{serial,qty}]}]

            for (var j = 0; j < count; j++) {
                ir.selectLine({ sublistId: 'item', line: j });

                var receiveFlag = ir.getCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive' });
                if (!receiveFlag) {
                    ir.commitLine({ sublistId: 'item' });
                    continue;
                }

                var itemId     = ir.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' });
                var itemText   = ir.getCurrentSublistText({ sublistId: 'item', fieldId: 'item' }) || itemId;
                var rem        = remaining[itemId] || [];
                var totalRem   = sum(rem);

                // Fulfilled qty from IF (sum of shipped serials for this item)
                var fulfilledQty = sumSerialQty(shipped[itemId] || {});
                var lineOrigQty  = Number(ir.getCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity' }) || 0);

                // Enforce: remaining must be > 0 and ≤ fulfilled and ≤ existing line qty
                if (totalRem <= 0 || totalRem > fulfilledQty || totalRem > lineOrigQty) {
                    log.debug('Quantity mismatch; unchecking', {
                        line: j, itemId: itemId, itemText: itemText,
                        totalRem: totalRem, fulfilledQty: fulfilledQty, lineOrigQty: lineOrigQty
                    });
                    ir.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: false });
                    ir.commitLine({ sublistId: 'item' });
                    continue;
                }

                // Set exact quantity FIRST (NetSuite strict check)
                ir.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: totalRem });

                var invDetail = ir.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });
                if (!invDetail) {
                    ir.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: false });
                    ir.commitLine({ sublistId: 'item' });
                    log.debug('No inventory detail subrecord; skipped', { line: j, itemId: itemId });
                    continue;
                }

                // Clear existing assignments
                var ex = invDetail.getLineCount({ sublistId: 'inventoryassignment' }) || 0;
                for (var x = ex - 1; x >= 0; x--) {
                    invDetail.removeLine({ sublistId: 'inventoryassignment', line: x });
                }

                // Assign remaining serials
                var lineAssignments = []; // for summary
                for (var r = 0; r < rem.length; r++) {
                    var entry = rem[r];
                    invDetail.selectNewLine({ sublistId: 'inventoryassignment' });
                    invDetail.setCurrentSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'receiptinventorynumber',
                        value: entry.serial // TEXT
                    });
                    invDetail.setCurrentSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'quantity',
                        value: entry.quantity
                    });
                    invDetail.commitLine({ sublistId: 'inventoryassignment' });

                    lineAssignments.push({ serial: entry.serial, qty: entry.quantity });
                }

                // Add to summary
                finalSummary.push({
                    line: j,
                    itemId: itemId,
                    itemText: itemText,
                    quantity: totalRem,
                    assignments: lineAssignments
                });

                ir.commitLine({ sublistId: 'item' });
            }

            // Log what we’re about to save
            log.audit('IR assignments summary (pre-save)', finalSummary);

            // Save & redirect
            var irId = ir.save({ enableSourcing: true, ignoreMandatoryFields: false });
            log.audit('Item Receipt created', { irId: irId, fromPO: poId, assignments: finalSummary });

            redirect.toRecord({ type: record.Type.ITEM_RECEIPT, id: irId });

        } catch (e) {
            log.error('Suitelet error', e);
            context.response.write('Failed to create Item Receipt. Check script logs.\n' + (e && e.message ? e.message : e));
        }
    }

    // ----------------- Helpers -----------------

    // Shipped serials across IFs of the SO: { itemId: { serialText: qty } }
    function getIFShippedByItemSerial(soId) {
        var byItem = {};
        var s = search.create({
            type: 'itemfulfillment',
            filters: [
                ['type', 'anyof', 'ItemShip'], 'AND',
                ['createdfrom', 'anyof', soId], 'AND',
                ['mainline', 'is', 'F']
            ],
            columns: [search.createColumn({ name: 'internalid', summary: 'GROUP' })]
        });

        var ids = [];
        s.run().each(function (r) {
            ids.push(r.getValue({ name: 'internalid', summary: 'GROUP' }));
            return true;
        });

        for (var k = 0; k < ids.length; k++) {
            var IF = record.load({ type: 'itemfulfillment', id: ids[k], isDynamic: false });
            var lc = IF.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < lc; i++) {
                var itemId = IF.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                var det = IF.getSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line: i });
                if (!det) continue;

                var ac = det.getLineCount({ sublistId: 'inventoryassignment' });
                for (var a = 0; a < ac; a++) {
                    var serialText = det.getSublistText({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', line: a });
                    var qty = Number(det.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', line: a }) || 0);

                    if (!byItem[itemId]) byItem[itemId] = {};
                    byItem[itemId][serialText] = (byItem[itemId][serialText] || 0) + qty; // accumulate across IFs
                }
            }
        }
        return byItem;
    }

    // Already received serials on prior IRs of this PO: { itemId: { serialText: qty } }
    function getIRReceivedByItemSerial(poId) {
        var byItem = {};
        var s = search.create({
            type: 'itemreceipt',
            filters: [
                ['type', 'anyof', 'ItemRcpt'], 'AND',
                ['createdfrom', 'anyof', poId], 'AND',
                ['mainline', 'is', 'F']
            ],
            columns: [search.createColumn({ name: 'internalid', summary: 'GROUP' })]
        });

        var ids = [];
        s.run().each(function (r) {
            ids.push(r.getValue({ name: 'internalid', summary: 'GROUP' }));
            return true;
        });

        for (var k = 0; k < ids.length; k++) {
            var IR = record.load({ type: 'itemreceipt', id: ids[k], isDynamic: false });
            var lc = IR.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < lc; i++) {
                var itemId = IR.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                var det = IR.getSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line: i });

                if (det) {
                    var ac = det.getLineCount({ sublistId: 'inventoryassignment' });
                    for (var a = 0; a < ac; a++) {
                        var serialText = det.getSublistText({ sublistId: 'inventoryassignment', fieldId: 'receiptinventorynumber', line: a });
                        var qty = Number(det.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', line: a }) || 0);

                        if (!byItem[itemId]) byItem[itemId] = {};
                        byItem[itemId][serialText] = (byItem[itemId][serialText] || 0) + qty;
                    }
                }
            }
        }
        return byItem;
    }

    // Remaining per item as a flat array [{serial, quantity}]
    function buildRemaining(shippedMap, alreadyMap) {
        var out = {};
        for (var itemId in shippedMap) {
            if (!shippedMap.hasOwnProperty(itemId)) continue;
            var serials = shippedMap[itemId];
            var rec     = alreadyMap[itemId] || {};
            var list    = [];

            for (var serial in serials) {
                if (!serials.hasOwnProperty(serial)) continue;
                var shippedQty  = Number(serials[serial]) || 0;
                var receivedQty = Number(rec[serial] || 0);
                var rem = shippedQty - receivedQty;
                if (rem > 0) list.push({ serial: serial, quantity: rem });
            }
            if (list.length) out[itemId] = list;
        }
        return out;
    }

    function sum(list) {
        var t = 0;
        for (var i = 0; i < list.length; i++) t += Number(list[i].quantity) || 0;
        return t;
    }

    function sumSerialQty(map) {
        var t = 0;
        for (var k in map) if (map.hasOwnProperty(k)) t += Number(map[k]) || 0;
        return t;
    }

    return { onRequest: onRequest };
});
