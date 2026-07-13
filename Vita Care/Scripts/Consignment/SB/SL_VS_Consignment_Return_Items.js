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

                if (orderStatus == 'A') {

                    log.debug('STATUS A DETECTED', 'Updating existing Inventory Transfer');

                    result = updateInventoryTransfer(soRec, items);

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

    function updateInventoryTransfer(soRec, items) {
        try {

            var transferId = soRec.getValue('custbody_vs_consignment_inventory_tran');

            if (!transferId) {
                throw 'No Inventory Transfer found on Sales Order';
            }

            log.debug('Transfer ID', transferId);

            var itRec = record.load({
                type: record.Type.INVENTORY_TRANSFER,
                id: transferId,
                isDynamic: true
            });

            var lineCount = itRec.getLineCount({ sublistId: 'inventory' });

            log.debug('Initial Line Count', lineCount);

            // =========================
            // 🔴 NEW LOGIC: DELETE IF ONLY ONE LINE
            // =========================
            if (lineCount == 1) {

                log.debug('ONLY ONE LINE', 'Deleting Inventory Transfer');

                record.delete({
                    type: record.Type.INVENTORY_TRANSFER,
                    id: transferId
                });

                log.debug('Inventory Transfer Deleted', transferId);

                return {
                    success: true,
                    type: 'INVENTORY_TRANSFER_DELETED',
                    id: transferId
                };
            }

            // =========================
            // EXISTING LOGIC (UNCHANGED)
            // =========================

            var itemMap = {};
            for (var i = 0; i < items.length; i++) {
                itemMap[items[i].item.toString()] = true;
            }

            log.debug('Item Map', itemMap);

            for (var j = lineCount - 1; j >= 0; j--) {

                var lineItem = itRec.getSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'item',
                    line: j
                });

                if (itemMap[lineItem.toString()]) {

                    log.debug('Removing Line', {
                        line: j,
                        item: lineItem
                    });

                    itRec.removeLine({
                        sublistId: 'inventory',
                        line: j
                    });
                }
            }

            var remainingLines = itRec.getLineCount({ sublistId: 'inventory' });

            log.debug('Remaining Lines', remainingLines);

            if (remainingLines == 0) {
                throw 'Inventory Transfer cannot be empty after removal';
            }

            var savedId = itRec.save();

            log.debug('Inventory Transfer Updated', savedId);

            return {
                success: true,
                type: 'INVENTORY_TRANSFER_UPDATED',
                id: savedId
            };

        } catch (e) {

            log.error('updateInventoryTransfer ERROR', e);
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

                var itemId = rmaRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item_display',
                    line: i
                });

                if (!itemMap[itemId.toString()]) {

                    rmaRec.removeLine({
                        sublistId: 'item',
                        line: i
                    });
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

                    var lineItem = rmaRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: y
                    });

                    if (lineItem.toString() == itemObj.item.toString()) {

                        rmaRec.selectLine({
                            sublistId: 'item',
                            line: y
                        });

                        var totalQty = 0;

                        for (var z = 0; z < batches.length; z++) {
                            totalQty += batches[z].quantity;
                        }

                        rmaRec.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: totalQty
                        });

                        var invDetail = rmaRec.getCurrentSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail'
                        });

                        for (var k = 0; k < batches.length; k++) {

                            invDetail.selectNewLine({
                                sublistId: 'inventoryassignment'
                            });

                            invDetail.setCurrentSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'receiptinventorynumber',
                                value: batches[k].lot
                            });

                            invDetail.setCurrentSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'quantity',
                                value: batches[k].quantity
                            });

                            invDetail.commitLine({
                                sublistId: 'inventoryassignment'
                            });
                        }

                        rmaRec.commitLine({
                            sublistId: 'item'
                        });
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

    return {
        onRequest: onRequest
    };

});