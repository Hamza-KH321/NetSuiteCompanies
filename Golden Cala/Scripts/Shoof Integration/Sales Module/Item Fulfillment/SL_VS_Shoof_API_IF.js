/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API IF
 */
define(['N/record', 'N/log', 'N/search'], function (record, log, search) {

    function onRequest(scriptContext) {
        var request = scriptContext.request;
        var response = scriptContext.response;

        if (request.method !== 'POST') {
            return sendJsonResponse(response, {
                success: false,
                code: 'METHOD_NOT_ALLOWED',
                message: 'Use POST with JSON body.'
            });
        }

        try {
            var requestBody = {};
            try {
                requestBody = JSON.parse(request.body || '{}');
            } catch (parseErr) {
                log.error('JSON_PARSE_ERROR', parseErr);
                return sendErrorResponse(response, 'INVALID_JSON', 'Request body must be valid JSON.');
            }

            log.audit('Shoof Fulfillment API - Incoming Request', requestBody);

            if (!isNumericValue(requestBody.createdfrom)) {
                return sendErrorResponse(response, 'VALIDATION_ERROR', '"createdfrom" (SO internal ID) is mandatory and must be numeric.');
            }
            var soId = parseInt(requestBody.createdfrom, 10);

            var payloadItems = Array.isArray(requestBody.items) ? requestBody.items : [];
            if (!payloadItems.length) {
                return sendErrorResponse(response, 'VALIDATION_ERROR', 'At least one item must be provided in "items".', {
                    itemsExample: [{
                        sku: "SKU-123",
                        inventoryAssignments: [
                            { inventoryNumber: "LOT-ABC", quantity: 1 }
                        ]
                    }]
                });
            }

            var payloadItemMap = {};
            for (var i = 0; i < payloadItems.length; i++) {
                var line = payloadItems[i];
                if (!line.sku) {
                    return sendErrorResponse(response, 'VALIDATION_ERROR', 'Each item must include "sku".', { line: i + 1 });
                }
                if (!Array.isArray(line.inventoryAssignments) || !line.inventoryAssignments.length) {
                    return sendErrorResponse(response, 'VALIDATION_ERROR', 'Each item must include inventoryAssignments array.', { line: i + 1 });
                }

                var itemId = findItemBySKU(line.sku);
                if (!itemId) {
                    return sendErrorResponse(response, 'VALIDATION_ERROR', 'Invalid SKU. Item not found.', { line: i + 1, sku: line.sku });
                }

                payloadItemMap[itemId] = line;
            }

            var fulfillment = record.transform({
                fromType: record.Type.SALES_ORDER,
                fromId: soId,
                toType: record.Type.ITEM_FULFILLMENT,
                isDynamic: true
            });

            fulfillment.setValue({ fieldId: 'customform', value: 170 }); // Shoof Item Fulfillment	
            fulfillment.setValue({ fieldId: 'custbody_vs_shoof_transaction', value: true });

            var lineCount = fulfillment.getLineCount({ sublistId: 'item' });

            for (var j = 0; j < lineCount; j++) {
                fulfillment.selectLine({ sublistId: 'item', line: j });

                var itemId = parseInt(fulfillment.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' }), 10);

                var payloadLine = payloadItemMap[itemId];

                if (!payloadLine) {
                    fulfillment.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: false });
                    fulfillment.commitLine({ sublistId: 'item' });
                    continue;
                }

                var locationId = fulfillment.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'location'
                });

                fulfillment.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: true });

                var inventoryDetail = fulfillment.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });

                var existingAssignments = inventoryDetail.getLineCount({ sublistId: 'inventoryassignment' });
                for (var x = existingAssignments - 1; x >= 0; x--) {
                    inventoryDetail.removeLine({ sublistId: 'inventoryassignment', line: x, ignoreRecalc: true });
                }

                for (var a = 0; a < payloadLine.inventoryAssignments.length; a++) {
                    var assign = payloadLine.inventoryAssignments[a];
                    if (!assign.inventoryNumber || !isNumericValue(assign.quantity)) {
                        return sendErrorResponse(response, 'VALIDATION_ERROR', 'Each inventory assignment requires inventoryNumber and numeric quantity.', { sku: payloadLine.sku });
                    }

                    var lotResult = findInventoryNumberId(
                        assign.inventoryNumber,
                        itemId,
                        locationId
                    );

                    if (!lotResult.success) {
                        return sendErrorResponse(
                            response,
                            lotResult.code,
                            lotResult.message,
                            lotResult.details
                        );
                    }

                    var lotInternalId = lotResult.internalId;

                    inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });
                    inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: lotInternalId });
                    inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: parseFloat(assign.quantity) });
                    inventoryDetail.commitLine({ sublistId: 'inventoryassignment' });
                }

                fulfillment.commitLine({ sublistId: 'item' });
            }

            var fulfillmentId = fulfillment.save({ enableSourcing: true, ignoreMandatoryFields: false });

            log.audit('IF_CREATED', { internalId: fulfillmentId });

            return sendJsonResponse(response, {
                success: true,
                recordType: 'itemfulfillment',
                internalId: String(fulfillmentId),
                warnings: []
            });

        } catch (e) {
            log.error('SL_VS_Shoof_API_IF_UNEXPECTED_ERROR', {
                name: e.name || '',
                message: e.message || '',
                stack: e.stack || ''
            });
            return sendJsonResponse(response, {
                success: false,
                code: 'SERVER_ERROR',
                message: 'Unexpected error.',
                details: { name: e.name || '', message: e.message || '' }
            });
        }
    }

    function sendJsonResponse(response, body) {
        try { response.addHeader({ name: 'Content-Type', value: 'application/json' }); } catch (e) { }
        response.write(JSON.stringify(body));
    }

    function sendErrorResponse(response, code, message, details) {
        return sendJsonResponse(response, {
            success: false,
            code: code,
            message: message,
            details: details || {}
        });
    }

    function isNumericValue(value) {
        return value !== null && value !== '' && isFinite(parseFloat(value));
    }

    function findItemBySKU(sku) {
        var itemId = null;
        var itemSearch = search.create({
            type: 'item',
            filters: [['custitem_vs_sku', 'is', sku]],
            columns: ['internalid']
        });
        itemSearch.run().each(function (result) {
            itemId = result.getValue('internalid');
            return false;
        });
        return itemId ? parseInt(itemId, 10) : null;
    }

    function findInventoryNumberId(lotNumber, itemId, locationId) {

        try {

            log.debug('Searching Inventory Number', {
                lotNumber: lotNumber,
                itemId: itemId,
                locationId: locationId
            });

            var lotId = null;

            var lotSearch = search.create({
                type: 'inventorynumber',
                filters: [
                    ['inventorynumber', 'is', lotNumber],
                    'AND',
                    ['item', 'anyof', itemId],
                    'AND',
                    ['location', 'anyof', locationId]
                ],
                columns: ['internalid']
            });

            lotSearch.run().each(function (result) {

                lotId = result.getValue('internalid');

                return false;
            });

            if (!lotId) {

                log.error('LOT_NOT_FOUND', {
                    lotNumber: lotNumber,
                    itemId: itemId,
                    locationId: locationId
                });

                return {
                    success: false,
                    code: 'LOT_NOT_FOUND',
                    message: 'The lot number "' + lotNumber + '" is not correct for this item/location. Please check the inventory.',
                    details: {
                        lotNumber: lotNumber,
                        itemId: itemId,
                        locationId: locationId
                    }
                };
            }

            return {
                success: true,
                internalId: parseInt(lotId, 10)
            };

        } catch (e) {

            log.error('FIND_INVENTORY_NUMBER_ERROR', {
                lotNumber: lotNumber,
                itemId: itemId,
                locationId: locationId,
                name: e.name || '',
                message: e.message || '',
                stack: e.stack || ''
            });

            return {
                success: false,
                code: 'LOT_SEARCH_ERROR',
                message: 'Unable to validate the lot number. Please check the inventory.',
                details: {
                    lotNumber: lotNumber,
                    itemId: itemId,
                    locationId: locationId,
                    error: e.message || ''
                }
            };
        }
    }

    return { onRequest: onRequest };
});
