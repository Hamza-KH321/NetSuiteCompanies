/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API VRA
 */

define(['N/record', 'N/search', 'N/log'], function(record, search, log) {

    function onRequest(context) {

        if (context.request.method != 'POST') {
            return sendJson(context, 405, {
                success: false,
                code: 'METHOD_NOT_ALLOWED',
                message: 'Use POST with JSON body.'
            });
        }

        var bodyStr = context.request.body || '{}';
        var body;

        try {
            body = JSON.parse(bodyStr);
        } catch (e) {

            log.error('INVALID_JSON', e);

            return sendJson(context, 400, {
                success: false,
                code: 'INVALID_JSON',
                message: 'Request body must be valid JSON.'
            });
        }

        log.audit('Shoof VRA API - Incoming', body);

        var errors = [];

        // Purchase Order validation
        var purchaseOrderId = body.purchaseOrderId;

        if (purchaseOrderId == undefined ||
            purchaseOrderId == null ||
            purchaseOrderId == '') {

            errors.push('purchaseOrderId is required.');

        } else if (!isValidNumber(purchaseOrderId)) {

            errors.push(
                'purchaseOrderId must be a valid internal ID.'
            );
        }

        // Items validation
        if (!body.items ||
            !Array.isArray(body.items) ||
            body.items.length == 0) {

            errors.push(
                'items is required and must contain at least one item.'
            );

        } else {

            for (var i = 0; i < body.items.length; i++) {

                if (!body.items[i].sku) {
                    errors.push(
                        'sku is required for item at index ' + i + '.'
                    );
                }

                var quantity = Number(body.items[i].quantity);

                if (!isFinite(quantity) || quantity <= 0) {
                    errors.push(
                        'quantity must be greater than 0 for item at index ' +
                        i + '.'
                    );
                }
            }
        }

        if (errors.length) {
            return sendJson(context, 400, {
                success: false,
                code: 'VALIDATION_ERROR',
                message: errors.join(' ')
            });
        }

        try {

            // Load Purchase Order
            var purchaseOrder = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: Number(purchaseOrderId),
                isDynamic: false
            });

            var poLineCount = purchaseOrder.getLineCount({
                sublistId: 'item'
            });

            log.audit('Purchase Order Loaded', {
                purchaseOrderId: purchaseOrderId,
                lineCount: poLineCount
            });

            // Transform Purchase Order to Vendor Return Authorization
            var vendorReturnAuthorization = record.transform({
                fromType: record.Type.PURCHASE_ORDER,
                fromId: Number(purchaseOrderId),
                toType: record.Type.VENDOR_RETURN_AUTHORIZATION,
                isDynamic: true
            });

            log.audit('Purchase Order Transformed', {
                purchaseOrderId: purchaseOrderId
            });

            // Set Shoof Form
            vendorReturnAuthorization.setValue({
                fieldId: 'customform',
                value: 176
            });

            // Set Shoof Transaction checkbox
            vendorReturnAuthorization.setValue({
                fieldId: 'custbody_vs_shoof_transaction',
                value: true
            });

            // Set Order Status - Pending Return
            vendorReturnAuthorization.setValue({
                fieldId: 'orderstatus',
                value: 'B'
            });

            // Set Memo
            if (body.memo) {
                vendorReturnAuthorization.setValue({
                    fieldId: 'memo',
                    value: String(body.memo)
                });
            }

            // Remove all transformed PO lines
            var vraLineCount = vendorReturnAuthorization.getLineCount({
                sublistId: 'item'
            });

            for (var j = vraLineCount - 1; j >= 0; j--) {

                vendorReturnAuthorization.removeLine({
                    sublistId: 'item',
                    line: j
                });
            }

            // Add requested items
            for (var k = 0; k < body.items.length; k++) {

                var requestedSku = String(body.items[k].sku).trim();
                var requestedQuantity = Number(body.items[k].quantity);

                var foundLine = -1;

                // Find SKU on Purchase Order
                for (var l = 0; l < poLineCount; l++) {

                    var itemId = purchaseOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: l
                    });

                    if (!itemId) {
                        continue;
                    }

                    var skuSearch = search.create({
                        type: search.Type.ITEM,
                        filters: [
                            ['internalid', 'anyof', itemId]
                        ],
                        columns: [
                            'custitem_vs_sku'
                        ]
                    });

                    var skuResult = skuSearch.run().getRange({
                        start: 0,
                        end: 1
                    });

                    var sku = '';

                    if (skuResult.length > 0) {
                        sku = skuResult[0].getValue({
                            name: 'custitem_vs_sku'
                        });
                    }

                    log.debug('PO Item SKU Check', {
                        line: l,
                        itemId: itemId,
                        sku: sku,
                        requestedSku: requestedSku
                    });

                    if (sku &&
                        String(sku).trim() == requestedSku) {

                        foundLine = l;
                        break;
                    }
                }

                if (foundLine == -1) {
                    throw new Error(
                        'SKU "' + requestedSku +
                        '" was not found on Purchase Order ' +
                        purchaseOrderId + '.'
                    );
                }

                // Get PO Quantity
                var poQuantity = Number(purchaseOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: foundLine
                })) || 0;

                if (requestedQuantity > Math.abs(poQuantity)) {
                    throw new Error(
                        'Return quantity for SKU "' +
                        requestedSku +
                        '" cannot be greater than PO quantity ' +
                        Math.abs(poQuantity) + '.'
                    );
                }

                // Get Item
                var purchaseOrderItemId = purchaseOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: foundLine
                });

                // Get Rate
                var rate = purchaseOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    line: foundLine
                });

                // Get Location
                var location = purchaseOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'location',
                    line: foundLine
                });

                // Add VRA Line
                vendorReturnAuthorization.selectNewLine({
                    sublistId: 'item'
                });

                vendorReturnAuthorization.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: purchaseOrderItemId
                });

                vendorReturnAuthorization.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: requestedQuantity
                });

                if (rate != null && rate != '') {
                    vendorReturnAuthorization.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: rate
                    });
                }

                if (location) {
                    vendorReturnAuthorization.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        value: location
                    });
                }

                vendorReturnAuthorization.commitLine({
                    sublistId: 'item'
                });

                log.audit('VRA Item Added', {
                    sku: requestedSku,
                    poLine: foundLine,
                    quantity: requestedQuantity
                });
            }

            // Save VRA
            var vendorReturnAuthorizationId =
                vendorReturnAuthorization.save();

            log.audit('Vendor Return Authorization Created', {
                id: vendorReturnAuthorizationId,
                purchaseOrderId: purchaseOrderId,
                itemCount: body.items.length
            });

            return sendJson(context, 200, {
                success: true,
                id: vendorReturnAuthorizationId,
                purchaseOrderId: Number(purchaseOrderId),
                message: 'Vendor Return Authorization created successfully.'
            });

        } catch (e) {

            log.error('VRA_CREATE_ERROR', {
                name: e.name,
                message: e.message,
                stack: e.stack,
                body: body
            });

            return sendJson(context, 500, {
                success: false,
                code: 'VRA_CREATE_ERROR',
                message: e && e.message
                    ? e.message
                    : 'Unexpected error while creating Vendor Return Authorization.'
            });
        }
    }

    function sendJson(context, status, obj) {

        context.response.addHeader({
            name: 'Content-Type',
            value: 'application/json'
        });

        context.response.status = status;

        context.response.write(JSON.stringify(obj));
    }

    function isValidNumber(value) {

        return value != null &&
            value != '' &&
            isFinite(Number(value));
    }

    return {
        onRequest: onRequest
    };
});