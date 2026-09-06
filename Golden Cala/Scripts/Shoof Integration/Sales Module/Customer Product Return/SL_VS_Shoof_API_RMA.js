/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API RMA
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

        log.audit('Shoof RMA API - Incoming', body);

        var errors = [];

        // Invoice validation
        var invoiceId = body.invoiceId;

        if (invoiceId == undefined || invoiceId == null || invoiceId == '') {
            errors.push('invoiceId is required.');
        } else if (!isValidNumber(invoiceId)) {
            errors.push('invoiceId must be a valid internal ID.');
        }

        // Items validation
        if (!body.items || !Array.isArray(body.items) || body.items.length == 0) {

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
                        'quantity must be greater than 0 for item at index ' + i + '.'
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

            // Load Invoice
            var invoice = record.load({
                type: record.Type.INVOICE,
                id: Number(invoiceId),
                isDynamic: false
            });

            var invoiceLineCount = invoice.getLineCount({
                sublistId: 'item'
            });

            log.audit('Invoice Loaded', {
                invoiceId: invoiceId,
                lineCount: invoiceLineCount
            });

            // Transform Invoice to Return Authorization
            var returnAuthorization = record.transform({
                fromType: record.Type.INVOICE,
                fromId: Number(invoiceId),
                toType: record.Type.RETURN_AUTHORIZATION,
                isDynamic: true
            });

            log.audit('Invoice Transformed', {
                invoiceId: invoiceId
            });

            // Set Shoof Form
            returnAuthorization.setValue({
                fieldId: 'customform',
                value: 175
            });

            // Set Shoof Transaction checkbox
            returnAuthorization.setValue({
                fieldId: 'custbody_vs_shoof_transaction',
                value: true
            });

            // Set Memo
            if (body.memo) {
                returnAuthorization.setValue({
                    fieldId: 'memo',
                    value: String(body.memo)
                });
            }

            // Remove all transformed invoice lines
            var rmaLineCount = returnAuthorization.getLineCount({
                sublistId: 'item'
            });

            for (var j = rmaLineCount - 1; j >= 0; j--) {

                returnAuthorization.removeLine({
                    sublistId: 'item',
                    line: j
                });
            }

            // Add requested items
            for (var k = 0; k < body.items.length; k++) {

                var requestedSku = String(body.items[k].sku).trim();
                var requestedQuantity = Number(body.items[k].quantity);

                var foundLine = -1;

                // Find SKU on Invoice
                for (var l = 0; l < invoiceLineCount; l++) {

                    var itemId = invoice.getSublistValue({
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

                    log.debug('Invoice Item SKU Check', {
                        line: l,
                        itemId: itemId,
                        sku: sku,
                        requestedSku: requestedSku
                    });

                    if (sku && String(sku).trim() == requestedSku) {
                        foundLine = l;
                        break;
                    }
                }

                if (foundLine == -1) {
                    throw new Error(
                        'SKU "' + requestedSku +
                        '" was not found on Invoice ' + invoiceId + '.'
                    );
                }

                // Get Invoice Quantity
                var invoiceQuantity = Number(invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: foundLine
                })) || 0;

                if (requestedQuantity > Math.abs(invoiceQuantity)) {
                    throw new Error(
                        'Return quantity for SKU "' + requestedSku +
                        '" cannot be greater than invoice quantity ' +
                        Math.abs(invoiceQuantity) + '.'
                    );
                }

                // Get Item
                var invoiceItemId = invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: foundLine
                });

                // Get Rate
                var rate = invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    line: foundLine
                });

                // Get Location
                var location = invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'location',
                    line: foundLine
                });

                // Add RMA Line
                returnAuthorization.selectNewLine({
                    sublistId: 'item'
                });

                returnAuthorization.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: invoiceItemId
                });

                returnAuthorization.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: requestedQuantity
                });

                if (rate != null && rate != '') {
                    returnAuthorization.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: rate
                    });
                }

                if (location) {
                    returnAuthorization.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        value: location
                    });
                }

                returnAuthorization.commitLine({
                    sublistId: 'item'
                });

                log.audit('RMA Item Added', {
                    sku: requestedSku,
                    invoiceLine: foundLine,
                    quantity: requestedQuantity
                });
            }

            // Save RMA
            var returnAuthorizationId = returnAuthorization.save();

            log.audit('Return Authorization Created', {
                id: returnAuthorizationId,
                invoiceId: invoiceId,
                itemCount: body.items.length
            });

            return sendJson(context, 200, {
                success: true,
                id: returnAuthorizationId,
                invoiceId: Number(invoiceId),
                message: 'Return Authorization created successfully.'
            });

        } catch (e) {

            log.error('RMA_CREATE_ERROR', {
                name: e.name,
                message: e.message,
                stack: e.stack,
                body: body
            });

            return sendJson(context, 500, {
                success: false,
                code: 'RMA_CREATE_ERROR',
                message: e && e.message
                    ? e.message
                    : 'Unexpected error while creating Return Authorization.'
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