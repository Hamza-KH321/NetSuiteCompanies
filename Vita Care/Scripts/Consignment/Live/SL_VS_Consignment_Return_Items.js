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

                if (orderStatus == 'A' || orderStatus == 'B') {

                    log.debug('STATUS A DETECTED', 'Updating existing Inventory Transfer');

                    result = createTransferOrder(soRec, soId, items);

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

    function createTransferOrder(soRec, soId, items) {
        try {
            var itemMap = getItemsMap(items);
            var lotMap = getLotMap(items);

            log.debug('createTransferOrder START', {
                soId: soId,
                items: items,
                itemMap: itemMap
            });

            var fromLocation = soRec.getValue('location');
            var toLocation = soRec.getValue('custbody_vs_original_warehouse');

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

                        var lotInternalId = lotMap[batches[k].lot.toString()];

                        if (!lotInternalId) {
                            log.error('Lot Not Found In Map', batches[k].lot);
                            throw 'Lot not found: ' + batches[k].lot;
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

    function getLotMap(items) {
        try {

            log.debug('getLotMap START', items);

            var lotValues = [];

            for (var i = 0; i < items.length; i++) {
                var batches = items[i].batches || [];

                for (var j = 0; j < batches.length; j++) {

                    var lot = batches[j].lot.toString();

                    if (lotValues.indexOf(lot) == -1) {
                        lotValues.push(lot);
                    }
                }
            }

            log.debug('Unique Lot Values', lotValues);

            if (!lotValues || lotValues.length == 0) {
                return {};
            }

            var map = {};

            var lotSearch = search.create({
                type: 'inventorynumber',
                filters: [
                    ['inventorynumber', 'is', lotValues[0]]
                ],
                columns: ['internalid', 'inventorynumber']
            });

            // 🔴 IMPORTANT: inventorynumber does NOT support "anyof" for text
            // so we build OR expression manually

            if (lotValues.length > 1) {

                var filters = [];

                for (var k = 0; k < lotValues.length; k++) {

                    if (k > 0) {
                        filters.push('OR');
                    }

                    filters.push(['inventorynumber', 'is', lotValues[k]]);
                }

                lotSearch = search.create({
                    type: 'inventorynumber',
                    filters: filters,
                    columns: ['internalid', 'inventorynumber']
                });
            }

            lotSearch.run().each(function (res) {

                var lotNumber = res.getValue('inventorynumber');
                var internalId = res.getValue('internalid');

                map[lotNumber.toString()] = internalId;

                return true;
            });

            log.debug('Lot Map Built', map);

            // 🔴 Validate all lots found
            for (var x = 0; x < lotValues.length; x++) {

                if (!map[lotValues[x]]) {
                    log.error('Lot Missing In Result', lotValues[x]);
                    throw 'Lot not found: ' + lotValues[x];
                }
            }

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