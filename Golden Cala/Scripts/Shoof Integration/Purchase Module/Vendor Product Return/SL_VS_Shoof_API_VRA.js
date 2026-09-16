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

        var body = {};

        try {

            var bodyStr = context.request.body || '{}';

            try {
                body = JSON.parse(bodyStr);
            } catch (parseError) {

                log.error('INVALID_JSON', {
                    name: parseError.name || '',
                    message: parseError.message || '',
                    stack: parseError.stack || ''
                });

                return sendJson(context, 400, {
                    success: false,
                    code: 'INVALID_JSON',
                    message: 'Request body must be valid JSON.'
                });
            }

            log.audit('Shoof VRA API - Incoming Request', body);

            var errors = [];

            /*
             * Vendor Validation
             */

            var vendorId = body.vendorId;

            if (vendorId == undefined ||
                vendorId == null ||
                vendorId == '') {

                errors.push('vendorId is required.');

            } else if (!isValidNumber(vendorId)) {

                errors.push(
                    'vendorId must be a valid internal ID.'
                );
            }

            /*
             * Items Validation
             */

            if (!body.items ||
                !Array.isArray(body.items) ||
                body.items.length == 0) {

                errors.push(
                    'items is required and must contain at least one item.'
                );

            } else {

                for (var i = 0; i < body.items.length; i++) {

                    var item = body.items[i];

                    if (!item.sku) {

                        errors.push(
                            'sku is required for item at index ' + i + '.'
                        );
                    }

                    var quantity = Number(item.quantity);

                    if (!isFinite(quantity) || quantity <= 0) {

                        errors.push(
                            'quantity must be greater than 0 for item at index ' +
                            i + '.'
                        );
                    }

                    var rate = Number(item.rate);

                    if (!isFinite(rate) || rate < 0) {

                        errors.push(
                            'rate is required and must be a number greater than or equal to 0 for item at index ' +
                            i + '.'
                        );
                    }

                    if (item.location == undefined ||
                        item.location == null ||
                        item.location == '') {

                        errors.push(
                            'location is required for item at index ' +
                            i + '.'
                        );

                    } else if (!isValidNumber(item.location)) {

                        errors.push(
                            'location must be a valid internal ID for item at index ' +
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

            vendorId = Number(vendorId);

            /*
             * Create Standalone Vendor Return Authorization
             */

            var vendorReturnAuthorization = record.create({
                type: record.Type.VENDOR_RETURN_AUTHORIZATION,
                isDynamic: true
            });

            log.audit('Standalone VRA Created In Memory', {
                vendorId: vendorId
            });

            /*
             * Set Header Fields
             */

            vendorReturnAuthorization.setValue({
                fieldId: 'customform',
                value: 176
            });

            vendorReturnAuthorization.setValue({
                fieldId: 'entity',
                value: vendorId
            });

            vendorReturnAuthorization.setValue({
                fieldId: 'custbody_vs_shoof_transaction',
                value: true
            });

            vendorReturnAuthorization.setValue({
                fieldId: 'orderstatus',
                value: 'B'
            });

            if (body.memo) {

                vendorReturnAuthorization.setValue({
                    fieldId: 'memo',
                    value: String(body.memo)
                });
            }

            log.debug('VRA Header Set', {
                vendorId: vendorId,
                memo: body.memo || ''
            });

            /*
             * Add Items
             */

            for (var j = 0; j < body.items.length; j++) {

                try {

                    var requestedSku =
                        String(body.items[j].sku).trim();

                    var requestedQuantity =
                        Number(body.items[j].quantity);

                    var requestedRate =
                        Number(body.items[j].rate);

                    var requestedLocation =
                        Number(body.items[j].location);

                    /*
                     * Find Item by Shoof SKU
                     */

                    var itemId = findItemBySKU(requestedSku);

                    if (!itemId) {

                        throw new Error(
                            'SKU "' +
                            requestedSku +
                            '" was not found in NetSuite.'
                        );
                    }

                    log.debug('VRA Item Found', {
                        sku: requestedSku,
                        itemId: itemId,
                        quantity: requestedQuantity,
                        rate: requestedRate,
                        location: requestedLocation
                    });

                    /*
                     * Add VRA Line
                     */

                    vendorReturnAuthorization.selectNewLine({
                        sublistId: 'item'
                    });

                    vendorReturnAuthorization.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: itemId
                    });

                    vendorReturnAuthorization.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: requestedQuantity
                    });

                    vendorReturnAuthorization.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: requestedRate
                    });

                    vendorReturnAuthorization.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        value: requestedLocation
                    });

                    vendorReturnAuthorization.commitLine({
                        sublistId: 'item'
                    });

                    log.audit('VRA Item Added', {
                        sku: requestedSku,
                        itemId: itemId,
                        quantity: requestedQuantity,
                        rate: requestedRate,
                        location: requestedLocation
                    });

                } catch (lineError) {

                    log.error('VRA_LINE_ERROR', {
                        line: j + 1,
                        name: lineError.name || '',
                        message: lineError.message || '',
                        stack: lineError.stack || ''
                    });

                    throw lineError;
                }
            }

            /*
             * Save VRA
             */

            var vendorReturnAuthorizationId =
                vendorReturnAuthorization.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: false
                });

            log.audit('Standalone Vendor Return Authorization Created', {
                id: vendorReturnAuthorizationId,
                vendorId: vendorId,
                itemCount: body.items.length
            });

            return sendJson(context, 200, {
                success: true,
                id: vendorReturnAuthorizationId,
                vendorId: vendorId,
                message: 'Vendor Return Authorization created successfully.'
            });

        } catch (e) {

            log.error('VRA_CREATE_ERROR', {
                name: e.name || '',
                message: e.message || '',
                stack: e.stack || '',
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
                message: e.message || '',
                stack: e.stack || ''
            });

            throw e;
        }
    }

    /*
     * Send JSON Response
     */

    function sendJson(context, status, obj) {

        try {

            context.response.addHeader({
                name: 'Content-Type',
                value: 'application/json'
            });

        } catch (headerError) {

            log.debug('HEADER_ERROR', {
                name: headerError.name || '',
                message: headerError.message || ''
            });
        }

        context.response.status = status;

        context.response.write(
            JSON.stringify(obj)
        );
    }

    /*
     * Validate Number
     */

    function isValidNumber(value) {

        return value != null &&
            value != '' &&
            isFinite(Number(value));
    }

    return {
        onRequest: onRequest
    };
});