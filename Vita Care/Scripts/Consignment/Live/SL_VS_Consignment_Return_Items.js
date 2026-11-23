/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Consignment Return Items
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function onRequest(context) {
        try {

            log.debug('START', 'Suitelet called');

            if (context.request.method != 'POST') {
                context.response.write(JSON.stringify({
                    success: false,
                    message: 'Only POST allowed'
                }));
                return;
            }

            var body = context.request.body;
            log.debug('Request Body', body);

            var data = JSON.parse(body);

            var salesOrderNumber = data.salesOrder;
            var beforeSales = data.beforeSales;
            var items = data.items || [];

            if (!salesOrderNumber) {
                throw 'Missing salesOrder';
            }

            // =========================
            // GET SALES ORDER
            // =========================
            var soId = getSalesOrderId(salesOrderNumber);
            log.debug('SO ID', soId);

            var soRec = record.load({ type: record.Type.SALES_ORDER, id: soId });

            var fromLocation = soRec.getValue('location');
            var toLocation = soRec.getValue('custbody_vs_original_warehouse');
            var orderStatus = soRec.getValue('orderstatus');

            log.debug('SO Details', {
                fromLocation: fromLocation,
                toLocation: toLocation,
                orderStatus: orderStatus
            });

            var result;

            // =========================
            // MAIN LOGIC
            // =========================
            if (beforeSales == true) {

                log.debug('beforeSales TRUE', 'Entering logic');

                if (orderStatus == 'A' || orderStatus == 'B' || orderStatus == 'D') {

                    result = createTransferOrder(soRec, soId, items);

                } else {

                    result = {
                        success: false,
                        error: 'Unsupported Sales Order status: ' + orderStatus
                    };
                }

            } else {

                result = createRMA(soId, items);

            }

            context.response.write(JSON.stringify(result));

        } catch (e) {

            log.error('ERROR', e);

            context.response.write(JSON.stringify({
                success: false,
                error: e.toString()
            }));
        }
    }

    // =========================
    // GET SALES ORDER ID
    // =========================
    function getSalesOrderId(tranId) {
        try {

            var soSearch = search.create({
                type: search.Type.SALES_ORDER,
                filters: [
                    ['tranid', 'is', tranId]
                ],
                columns: ['internalid']
            });

            var res = soSearch.run().getRange({ start: 0, end: 1 });

            if (!res || res.length == 0) {
                throw 'Sales Order not found';
            }

            return res[0].getValue('internalid');

        } catch (e) {
            log.error('getSalesOrderId ERROR', e);
            throw e;
        }
    }

    // =========================
    // CREATE TRANSFER ORDER
    // =========================
    function createTransferOrder(soRec, soId, items) {
        try {

            var fromLocation = soRec.getValue('location');
            var toLocation = soRec.getValue('custbody_vs_original_warehouse');

            var itemMap = getItemsMap(items);
            var lotMap = getLotMap(items, itemMap, fromLocation);

            log.debug('createTransferOrder START', {
                soId: soId,
                items: items,
                itemMap: itemMap,
                lotMap: lotMap
            });

            log.debug('Locations', {
                fromLocation: fromLocation,
                toLocation: toLocation
            });

            var toRec = record.create({ type: record.Type.TRANSFER_ORDER, isDynamic: true });

            // =========================
            // SET BODY FIELDS
            // =========================
            toRec.setValue({ fieldId: 'subsidiary', value: 1 });
            toRec.setValue({ fieldId: 'incoterm', value: 1 });
            toRec.setValue({ fieldId: 'location', value: fromLocation });
            toRec.setValue({ fieldId: 'transferlocation', value: toLocation });
            toRec.setValue({ fieldId: 'custbody_vs_consignment_to', value: true });
            toRec.setValue({ fieldId: 'custbody_vs_consignment_sales_order', value: soId });

            // =========================
            // ADD LINES
            // =========================
            for (var i = 0; i < items.length; i++) {

                var itemObj = items[i];
                var batches = itemObj.batches || [];

                var totalQty = 0;

                for (var j = 0; j < batches.length; j++) {
                    totalQty += batches[j].quantity;
                }

                log.debug('Processing Item', {
                    item: itemObj.item,
                    totalQty: totalQty
                });

                var internalItemId = itemMap[itemObj.item.toString()];

                toRec.selectNewLine({ sublistId: 'item' });

                toRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: internalItemId });
                toRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: totalQty });

                var invDetail = toRec.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });

                if (invDetail) {

                    for (var k = 0; k < batches.length; k++) {

                        log.debug('Batch', batches[k]);

                        // lot is resolved per item, so the same lot number on another item is never picked
                        var lotKey = internalItemId + '_' + batches[k].lot.toString();
                        var lotInternalId = lotMap[lotKey];

                        if (!lotInternalId) {
                            log.error('Lot Not Found In Map', lotKey);
                            throw 'Lot not found: ' + batches[k].lot + ' for item ' + itemObj.item;
                        }

                        invDetail.selectNewLine({ sublistId: 'inventoryassignment' });

                        invDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: lotInternalId });
                        invDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: batches[k].quantity });

                        invDetail.commitLine({ sublistId: 'inventoryassignment' });
                    }
                }

                toRec.commitLine({
                    sublistId: 'item'
                });
            }

            var toId = toRec.save();

            log.debug('Transfer Order Created', toId);

            return {
                success: true,
                type: 'TRANSFER_ORDER',
                id: toId
            };

        } catch (e) {

            log.error('createTransferOrder ERROR', e);
            throw e;
        }
    }

    // =========================
    // CREATE RMA (UNCHANGED)
    // =========================
    function createRMA(soId, items) {
        try {

            log.debug('createRMA START', {
                soId: soId,
                items: items
            });

            var rmaRec = record.transform({
                fromType: record.Type.SALES_ORDER,
                fromId: soId,
                toType: record.Type.RETURN_AUTHORIZATION,
                isDynamic: true
            });

            rmaRec.setValue('orderstatus', 'A');
            rmaRec.setValue('custbody8', 4);

            var lineCount = rmaRec.getLineCount({ sublistId: 'item' });

            var itemMap = {};
            for (var j = 0; j < items.length; j++) {
                itemMap[items[j].item.toString()] = items[j];
            }

            for (var i = lineCount - 1; i >= 0; i--) {

                var itemId = rmaRec.getSublistValue({ sublistId: 'item', fieldId: 'item_display', line: i });

                if (!itemMap[itemId.toString()]) {

                    rmaRec.removeLine({ sublistId: 'item', line: i });
                }
            }

            var remainingLines = rmaRec.getLineCount({ sublistId: 'item' });

            if (remainingLines == 0) {
                throw 'No matching items found between request and Sales Order';
            }

            for (var x = 0; x < items.length; x++) {

                var itemObj = items[x];
                var batches = itemObj.batches || [];

                var rmaLineCount = rmaRec.getLineCount({ sublistId: 'item' });

                for (var y = 0; y < rmaLineCount; y++) {

                    var lineItem = rmaRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: y });

                    if (lineItem.toString() == itemObj.item.toString()) {

                        rmaRec.selectLine({ sublistId: 'item', line: y });

                        var totalQty = 0;

                        for (var z = 0; z < batches.length; z++) {
                            totalQty += batches[z].quantity;
                        }

                        rmaRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: totalQty });

                        var invDetail = rmaRec.getCurrentSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail'
                        });

                        for (var k = 0; k < batches.length; k++) {

                            invDetail.selectNewLine({ sublistId: 'inventoryassignment' });

                            invDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'receiptinventorynumber', value: batches[k].lot });
                            invDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: batches[k].quantity });

                            invDetail.commitLine({ sublistId: 'inventoryassignment' });
                        }

                        rmaRec.commitLine({ sublistId: 'item' });
                    }
                }
            }

            var rmaId = rmaRec.save();

            log.debug('RMA Created', rmaId);

            return {
                success: true,
                type: 'RMA',
                id: rmaId
            };

        } catch (e) {

            log.error('createRMA ERROR', e);

            throw e;
        }
    }

    // =========================
    // ITEM MAP (itemid -> internal id)
    // =========================
    function getItemsMap(items) {
        try {

            log.debug('getItemsMap START', items);

            var map = {};

            for (var i = 0; i < items.length; i++) {

                var itemValue = items[i].item.toString();

                log.debug('Searching Item', itemValue);

                var itemSearch = search.create({
                    type: search.Type.ITEM,
                    filters: [
                        ['itemid', 'is', itemValue]
                    ],
                    columns: ['internalid', 'itemid']
                });

                var res = itemSearch.run().getRange({ start: 0, end: 1 });

                if (res && res.length > 0) {

                    var internalId = res[0].getValue('internalid');

                    map[itemValue] = internalId;

                    log.debug('Mapped Item', {
                        input: itemValue,
                        internalId: internalId
                    });

                } else {

                    log.error('Item Not Found', itemValue);
                    throw 'Item not found: ' + itemValue;
                }
            }

            log.debug('Final Item Map', map);

            return map;

        } catch (e) {
            log.error('getItemsMap ERROR', e);
            throw e;
        }
    }

    // =========================
    // LOT MAP (item internal id + lot number -> inventory number internal id)
    // Lot numbers are only unique per item, so the item and source location are part of the search
    // =========================
    function getLotMap(items, itemMap, fromLocation) {
        try {

            log.debug('getLotMap START', {
                items: items,
                fromLocation: fromLocation
            });

            var map = {};

            for (var i = 0; i < items.length; i++) {

                var itemInternalId = itemMap[items[i].item.toString()];
                var batches = items[i].batches || [];

                for (var j = 0; j < batches.length; j++) {

                    var lot = batches[j].lot.toString();
                    var key = itemInternalId + '_' + lot;

                    if (map[key]) {
                        continue;
                    }

                    var lotSearch = search.create({
                        type: 'inventorynumber',
                        filters: [
                            ['item', 'anyof', itemInternalId],
                            'AND',
                            ['inventorynumber', 'is', lot],
                            'AND',
                            ['location', 'anyof', fromLocation]
                        ],
                        columns: ['internalid', 'inventorynumber']
                    });

                    var res = lotSearch.run().getRange({ start: 0, end: 1 });

                    if (!res || res.length == 0) {
                        log.error('Lot Missing In Result', key);
                        throw 'Lot ' + lot + ' not found for item ' + items[i].item + ' in location ' + fromLocation;
                    }

                    map[key] = res[0].getValue('internalid');
                }
            }

            log.debug('Lot Map Built', map);

            return map;

        } catch (e) {
            log.error('getLotMap ERROR', e);
            throw e;
        }
    }

    return {
        onRequest: onRequest
    };

});