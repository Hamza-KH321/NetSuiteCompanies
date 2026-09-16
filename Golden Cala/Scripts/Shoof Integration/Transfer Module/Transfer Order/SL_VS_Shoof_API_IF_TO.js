/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API IF TO
 */

define(['N/record', 'N/search', 'N/log'], function(record, search, log) {

    function onRequest(context) {

        if (context.request.method != 'POST') {

            context.response.write(JSON.stringify({
                success: false,
                code: 'METHOD_NOT_ALLOWED',
                message: 'Use POST with JSON body.'
            }));

            return;
        }

        try {

            var body = JSON.parse(context.request.body || '{}');

            log.audit('Incoming Request', body);

            if (!body.transferOrderId) {
                throw new Error('transferOrderId is required.');
            }

            if (!body.lines ||
                !Array.isArray(body.lines) ||
                body.lines.length == 0) {

                throw new Error('No lines provided.');
            }

            var requestMap = {};

            for (var r = 0; r < body.lines.length; r++) {

                var requestLine = body.lines[r];

                if (!requestLine.sku) {
                    throw new Error(
                        'SKU is required for line ' + (r + 1) + '.'
                    );
                }

                requestMap[requestLine.sku] = requestLine;
            }

            log.debug('Request Map Created', requestMap);

            var ifRec = record.transform({
                fromType: record.Type.TRANSFER_ORDER,
                fromId: body.transferOrderId,
                toType: record.Type.ITEM_FULFILLMENT,
                isDynamic: true
            });

            log.audit('Transfer Order Transformed', {
                transferOrderId: body.transferOrderId
            });

            ifRec.setValue({
                fieldId: 'custbody_vs_shoof_transaction',
                value: true
            });

            var lineCount = ifRec.getLineCount({
                sublistId: 'item'
            });

            log.debug('Fulfillment Line Count', lineCount);

            for (var i = 0; i < lineCount; i++) {

                try {

                    ifRec.selectLine({
                        sublistId: 'item',
                        line: i
                    });

                    var currentItemId = ifRec.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item'
                    });

                    var currentSku = getSkuByItemId(currentItemId);

                    log.debug('Processing Fulfillment Line', {
                        line: i + 1,
                        itemId: currentItemId,
                        sku: currentSku
                    });

                    var reqLine = requestMap[currentSku];

                    if (!reqLine) {

                        ifRec.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'itemreceive',
                            value: false
                        });

                        ifRec.commitLine({
                            sublistId: 'item'
                        });

                        log.debug('Line Skipped', {
                            line: i + 1,
                            sku: currentSku,
                            reason: 'SKU not included in request'
                        });

                        continue;
                    }

                    var itemId = findItemBySKU(reqLine.sku);

                    if (!itemId) {
                        throw new Error(
                            'Item not found for SKU: ' + reqLine.sku
                        );
                    }

                    /*
                     * Validate lots
                     */

                    if (!Object.prototype.hasOwnProperty.call(reqLine, 'lots')) {

                        throw new Error(
                            'Lots must be provided for SKU: ' +
                            reqLine.sku +
                            '. If no lot is required, send lotNumber as empty and quantity as 0.'
                        );
                    }

                    if (!Array.isArray(reqLine.lots)) {

                        throw new Error(
                            'lots must be an array for SKU: ' +
                            reqLine.sku
                        );
                    }

                    var hasLot = false;
                    var totalLotQty = 0;

                    for (var l = 0; l < reqLine.lots.length; l++) {

                        var lot = reqLine.lots[l];

                        if (!lot.lotNumber ||
                            String(lot.lotNumber).trim() == '') {

                            continue;
                        }

                        if (!isFinite(parseFloat(lot.quantity)) ||
                            parseFloat(lot.quantity) <= 0) {

                            throw new Error(
                                'Lot quantity must be greater than 0 for SKU: ' +
                                reqLine.sku
                            );
                        }

                        hasLot = true;

                        totalLotQty += parseFloat(lot.quantity);
                    }

                    if (hasLot &&
                        parseFloat(totalLotQty) != parseFloat(reqLine.quantity)) {

                        throw new Error(
                            'Total lot qty (' +
                            totalLotQty +
                            ') does not match line qty (' +
                            reqLine.quantity +
                            ') for SKU: ' +
                            reqLine.sku
                        );
                    }

                    /*
                     * Receive Item
                     */

                    ifRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemreceive',
                        value: true
                    });

                    ifRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: parseFloat(reqLine.quantity)
                    });

                    log.debug('Fulfillment Quantity Set', {
                        sku: reqLine.sku,
                        quantity: reqLine.quantity,
                        hasLot: hasLot
                    });

                    /*
                     * Inventory Detail
                     */

                    if (hasLot) {

                        var invDetail = ifRec.getCurrentSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail'
                        });

                        log.debug('Inventory Detail Retrieved', {
                            sku: reqLine.sku
                        });

                        for (var m = 0; m < reqLine.lots.length; m++) {

                            var lotAssignment = reqLine.lots[m];

                            if (!lotAssignment.lotNumber ||
                                String(lotAssignment.lotNumber).trim() == '') {

                                continue;
                            }

                            var lotNumber =
                                String(lotAssignment.lotNumber).trim();

                            var lotId = findLotId(
                                itemId,
                                lotNumber
                            );

                            if (!lotId) {

                                throw new Error(
                                    'Lot not found for SKU ' +
                                    reqLine.sku +
                                    ', Lot: ' +
                                    lotNumber
                                );
                            }

                            invDetail.selectNewLine({
                                sublistId: 'inventoryassignment'
                            });

                            invDetail.setCurrentSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'issueinventorynumber',
                                value: lotId
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
                                sku: reqLine.sku,
                                lotNumber: lotNumber,
                                lotId: lotId,
                                quantity: lotAssignment.quantity
                            });
                        }

                    } else {

                        log.debug('Inventory Assignment Skipped', {
                            sku: reqLine.sku,
                            reason: 'No lot number provided'
                        });
                    }

                    ifRec.commitLine({
                        sublistId: 'item'
                    });

                    log.audit('Fulfillment Line Processed', {
                        line: i + 1,
                        sku: reqLine.sku,
                        quantity: reqLine.quantity,
                        hasLot: hasLot
                    });

                } catch (lineError) {

                    log.error('FULFILLMENT_LINE_ERROR', {
                        line: i + 1,
                        name: lineError.name || '',
                        message: lineError.message || '',
                        stack: lineError.stack || ''
                    });

                    throw lineError;
                }
            }

            /*
             * Save Item Fulfillment
             */

            var ifId = ifRec.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            log.audit('IF_CREATED', {
                internalId: ifId,
                transferOrderId: body.transferOrderId
            });

            context.response.write(JSON.stringify({
                success: true,
                message: 'Item Fulfillment created successfully.',
                id: ifId
            }));

        } catch (e) {

            log.error('SL_VS_Shoof_API_IF_TO_ERROR', {
                name: e.name || '',
                message: e.message || '',
                stack: e.stack || ''
            });

            context.response.write(JSON.stringify({
                success: false,
                code: 'SERVER_ERROR',
                message: e.message || e.toString()
            }));
        }
    }

    /*
     * Find Item by Shoof SKU
     */

    function findItemBySKU(sku) {

        try {

            var itemSearch = search.create({
                type: search.Type.ITEM,
                filters: [
                    ['custitem_vs_sku', 'is', sku]
                ],
                columns: [
                    'internalid'
                ]
            }).run().getRange({
                start: 0,
                end: 1
            });

            if (itemSearch && itemSearch.length > 0) {

                return itemSearch[0].getValue({
                    name: 'internalid'
                });
            }

            return null;

        } catch (e) {

            log.error('FIND_ITEM_BY_SKU_ERROR', {
                sku: sku,
                name: e.name || '',
                message: e.message || ''
            });

            throw e;
        }
    }

    /*
     * Get Shoof SKU by Item Internal ID
     */

    function getSkuByItemId(itemId) {

        try {

            var itemSearch = search.create({
                type: search.Type.ITEM,
                filters: [
                    ['internalid', 'anyof', itemId]
                ],
                columns: [
                    'custitem_vs_sku'
                ]
            }).run().getRange({
                start: 0,
                end: 1
            });

            if (itemSearch && itemSearch.length > 0) {

                return itemSearch[0].getValue({
                    name: 'custitem_vs_sku'
                });
            }

            return null;

        } catch (e) {

            log.error('GET_SKU_BY_ITEM_ID_ERROR', {
                itemId: itemId,
                name: e.name || '',
                message: e.message || ''
            });

            throw e;
        }
    }

    /*
     * Find Inventory Number
     */

    function findLotId(itemId, lotNumber) {

        try {

            log.debug('Searching Lot', {
                itemId: itemId,
                lotNumber: lotNumber
            });

            var lotSearch = search.create({
                type: 'inventorynumber',
                filters: [
                    ['inventorynumber', 'is', lotNumber],
                    'AND',
                    ['item', 'anyof', itemId]
                ],
                columns: [
                    'internalid'
                ]
            }).run().getRange({
                start: 0,
                end: 1
            });

            if (lotSearch && lotSearch.length > 0) {

                var lotId = lotSearch[0].getValue({
                    name: 'internalid'
                });

                log.debug('Lot Found', {
                    itemId: itemId,
                    lotNumber: lotNumber,
                    lotId: lotId
                });

                return lotId;
            }

            log.error('LOT_NOT_FOUND', {
                itemId: itemId,
                lotNumber: lotNumber
            });

            return null;

        } catch (e) {

            log.error('FIND_LOT_ID_ERROR', {
                itemId: itemId,
                lotNumber: lotNumber,
                name: e.name || '',
                message: e.message || '',
                stack: e.stack || ''
            });

            throw e;
        }
    }

    return {
        onRequest: onRequest
    };
});