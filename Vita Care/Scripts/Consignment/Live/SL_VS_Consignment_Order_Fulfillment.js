/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Consignment Order Fulfillment
 */

define(['N/record', 'N/search', 'N/log'],
    function (record, search, log) {

        function onRequest(context) {
            try {

                log.debug('START', 'Suitelet Triggered');

                if (context.request.method != 'POST') {
                    context.response.write(JSON.stringify({
                        success: false,
                        message: 'Only POST allowed'
                    }));
                    return;
                }

                var body = context.request.body;
                log.debug('Request Body', body);

                var requestData = JSON.parse(body);

                var soNumber = requestData.soNumber;
                var items = requestData.items;

                if (!soNumber || !items || !items.length) {
                    throw 'Missing required parameters';
                }

                // =====================================
                // Map Item Name → Internal ID
                // =====================================

                var itemNameToIdMap = {};

                try {

                    var itemFilters = [];

                    for (var i = 0; i < items.length; i++) {

                        if (i > 0) {
                            itemFilters.push('OR');
                        }

                        itemFilters.push(['itemid', 'is', items[i].item]);
                    }

                    var itemSearch = search.create({
                        type: search.Type.ITEM,
                        filters: itemFilters,
                        columns: ['internalid', 'itemid']
                    });

                    itemSearch.run().each(function (result) {

                        var name = result.getValue('itemid');
                        var id = result.getValue('internalid');

                        itemNameToIdMap[name] = id;

                        return true;
                    });

                    log.debug('Item Map', itemNameToIdMap);

                } catch (e) {
                    log.error('Item Mapping Error', e);
                    throw e;
                }

                // =====================================
                // Get Sales Order Internal ID
                // =====================================

                var soSearch = search.create({
                    type: search.Type.SALES_ORDER,
                    filters: [['tranid', 'is', soNumber]],
                    columns: ['internalid']
                });

                var soResult = soSearch.run().getRange({ start: 0, end: 1 });

                if (!soResult || !soResult.length) {
                    throw 'Sales Order not found';
                }

                var soId = soResult[0].getValue('internalid');
                log.debug('Sales Order ID', soId);

                // =====================================
                // Transform SO → Item Fulfillment
                // =====================================

                var ifRecord = record.transform({
                    fromType: record.Type.SALES_ORDER,
                    fromId: soId,
                    toType: record.Type.ITEM_FULFILLMENT,
                    isDynamic: true
                });

                ifRecord.setValue({ fieldId: 'shipstatus', value: 'C' });
                ifRecord.setValue({ fieldId: 'custbody_vs_consignment_order', value: true });

                log.debug('Item Fulfillment Created', 'Dynamic Mode');

                // =====================================
                // Collect All Lots
                // =====================================

                var allLotNumbers = [];

                for (var i = 0; i < items.length; i++) {

                    var invList = items[i].inventory;

                    if (invList && invList.length) {

                        for (var j = 0; j < invList.length; j++) {

                            var lotNum = invList[j].receiptinventorynumber;

                            if (allLotNumbers.indexOf(lotNum) == -1) {
                                allLotNumbers.push(lotNum);
                            }
                        }
                    }
                }

                log.debug('All Lot Numbers', allLotNumbers);

                // =====================================
                // Build Item IDs for Lot Search
                // =====================================

                var itemIds = [];

                for (var i = 0; i < items.length; i++) {

                    var mappedId = itemNameToIdMap[items[i].item];

                    if (mappedId && itemIds.indexOf(mappedId) == -1) {
                        itemIds.push(mappedId);
                    }
                }

                // =====================================
                // Lot Search (FIXED)
                // =====================================

                var lotMap = {};

                if (allLotNumbers.length) {

                    var lotFilters = [];

                    for (var i = 0; i < allLotNumbers.length; i++) {

                        if (i > 0) {
                            lotFilters.push('OR');
                        }

                        lotFilters.push(['inventorynumber', 'is', allLotNumbers[i]]);
                    }

                    if (itemIds.length) {
                        lotFilters.push('AND');
                        lotFilters.push(['item', 'anyof', itemIds]);
                    }

                    log.debug('Lot Filters', JSON.stringify(lotFilters));

                    var lotSearch = search.create({
                        type: 'inventorynumber',
                        filters: lotFilters,
                        columns: [
                            'inventorynumber',
                            'internalid',
                            'item',
                            'location'
                        ]
                    });

                    lotSearch.run().each(function (result) {

                        try {

                            var lotName = result.getValue('inventorynumber');
                            var lotInternalId = result.getValue('internalid');
                            var itemId = result.getValue('item');
                            var locationId = result.getValue('location');

                            var key = itemId + '|' + lotName + '|' + locationId;

                            lotMap[key] = lotInternalId;

                            log.debug('Lot Mapping', key);

                            return true;

                        } catch (innerErr) {
                            log.error('Lot Mapping Error', innerErr);
                            return true;
                        }
                    });
                }

                log.debug('Lot Map', lotMap);

                // =====================================
                // Process Lines
                // =====================================

                var lineCount = ifRecord.getLineCount({ sublistId: 'item' });
                log.debug('IF Line Count', lineCount);

                for (var i = 0; i < lineCount; i++) {

                    ifRecord.selectLine({
                        sublistId: 'item',
                        line: i
                    });

                    var currentItem = ifRecord.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item'
                    });

                    var locationId = ifRecord.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'location'
                    });

                    log.debug('Processing Line', {
                        line: i,
                        item: currentItem,
                        location: locationId
                    });

                    var jsonItem = null;

                    for (var j = 0; j < items.length; j++) {

                        var mappedItemId = itemNameToIdMap[items[j].item];

                        if (mappedItemId == currentItem) {
                            jsonItem = items[j];
                            break;
                        }
                    }

                    if (!jsonItem) {

                        log.debug('Skipping Line', 'No matching JSON item');

                        ifRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'itemreceive',
                            value: false
                        });

                        ifRecord.commitLine({ sublistId: 'item' });
                        continue;
                    }

                    ifRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemreceive',
                        value: true
                    });

                    ifRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: jsonItem.quantity
                    });

                    var inventoryList = jsonItem.inventory;

                    if (inventoryList && inventoryList.length) {

                        var inventoryDetail = ifRecord.getCurrentSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail'
                        });

                        for (var k = 0; k < inventoryList.length; k++) {

                            var lotNumber = inventoryList[k].receiptinventorynumber;

                            var key = currentItem + '|' + lotNumber + '|' + locationId;

                            var lotInternalId = lotMap[key];

                            log.debug('Lot Resolution', {
                                key: key,
                                lotInternalId: lotInternalId
                            });

                            if (!lotInternalId) {
                                throw 'Lot not valid for item/location: ' + lotNumber;
                            }

                            inventoryDetail.selectNewLine({
                                sublistId: 'inventoryassignment'
                            });

                            inventoryDetail.setCurrentSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'issueinventorynumber',
                                value: lotInternalId
                            });

                            inventoryDetail.setCurrentSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'quantity',
                                value: inventoryList[k].quantity
                            });

                            inventoryDetail.commitLine({
                                sublistId: 'inventoryassignment'
                            });

                            log.debug('Inventory Assigned', lotNumber);
                        }
                    }

                    ifRecord.commitLine({
                        sublistId: 'item'
                    });
                }

                // =====================================
                // Save
                // =====================================

                var ifId = ifRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: false
                });

                log.debug('Item Fulfillment Saved', ifId);

                context.response.write(JSON.stringify({
                    success: true,
                    fulfillmentId: ifId
                }));

            } catch (e) {

                log.error('ERROR', e);

                context.response.write(JSON.stringify({
                    success: false,
                    message: e.toString()
                }));
            }
        }

        return {
            onRequest: onRequest
        };

    });