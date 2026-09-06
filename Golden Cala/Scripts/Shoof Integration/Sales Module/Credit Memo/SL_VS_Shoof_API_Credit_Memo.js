/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API Credit Memo
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

        log.audit('Shoof Credit Memo API - Incoming', body);

        var errors = [];

        var customerId = body.customerId;
        var locationId = body.locationId;

        if (customerId == undefined ||
            customerId == null ||
            customerId == '') {

            errors.push('customerId is required.');

        } else if (!isValidNumber(customerId)) {

            errors.push(
                'customerId must be a valid internal ID.'
            );
        }

        if (locationId == undefined ||
            locationId == null ||
            locationId == '') {

            errors.push('locationId is required.');

        } else if (!isValidNumber(locationId)) {

            errors.push(
                'locationId must be a valid internal ID.'
            );
        }

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

                if (!item.lotNumber) {
                    errors.push(
                        'lotNumber is required for item at index ' +
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

            var creditMemo = record.create({
                type: record.Type.CREDIT_MEMO,
                isDynamic: true
            });

            log.audit('Credit Memo Created In Memory', {
                customerId: customerId,
                locationId: locationId
            });

            /*
             * Header fields
             */

            creditMemo.setValue({
                fieldId: 'customform',
                value: 177
            });

            creditMemo.setValue({
                fieldId: 'entity',
                value: Number(customerId)
            });

            creditMemo.setValue({
                fieldId: 'location',
                value: Number(locationId)
            });

            creditMemo.setValue({
                fieldId: 'custbody_vs_shoof_transaction',
                value: true
            });

            if (body.memo) {

                creditMemo.setValue({
                    fieldId: 'memo',
                    value: String(body.memo)
                });
            }

            /*
             * Add Items
             */

            for (var j = 0; j < body.items.length; j++) {

                var requestedSku =
                    String(body.items[j].sku).trim();

                var requestedQuantity =
                    Number(body.items[j].quantity);

                var requestedRate =
                    Number(body.items[j].rate);

                var lotNumber =
                    String(body.items[j].lotNumber).trim();

                /*
                 * Find Item by Shoof SKU
                 */

                var skuSearch = search.create({
                    type: search.Type.ITEM,
                    filters: [
                        ['custitem_vs_sku', 'is', requestedSku]
                    ],
                    columns: [
                        'internalid',
                        'custitem_vs_sku'
                    ]
                });

                var skuResult = skuSearch.run().getRange({
                    start: 0,
                    end: 1
                });

                if (!skuResult ||
                    skuResult.length == 0) {

                    throw new Error(
                        'SKU "' +
                        requestedSku +
                        '" was not found in NetSuite.'
                    );
                }

                var itemId = skuResult[0].getValue({
                    name: 'internalid'
                });

                log.debug('Credit Memo Item Found', {
                    sku: requestedSku,
                    itemId: itemId,
                    quantity: requestedQuantity,
                    rate: requestedRate,
                    lotNumber: lotNumber
                });

                /*
                 * Add Credit Memo Line
                 */

                creditMemo.selectNewLine({
                    sublistId: 'item'
                });

                creditMemo.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: itemId
                });

                creditMemo.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: requestedQuantity
                });

                creditMemo.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    value: requestedRate
                });

                creditMemo.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'location',
                    value: Number(locationId)
                });

                /*
                 * Configure Inventory Detail
                 */

                var inventoryDetail =
                    creditMemo.getCurrentSublistSubrecord({
                        sublistId: 'item',
                        fieldId: 'inventorydetail'
                    });

                log.debug('Inventory Detail Created', {
                    sku: requestedSku,
                    itemId: itemId,
                    lotNumber: lotNumber,
                    quantity: requestedQuantity
                });

                inventoryDetail.selectNewLine({
                    sublistId: 'inventoryassignment'
                });

                inventoryDetail.setCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'receiptinventorynumber',
                    value: lotNumber
                });

                inventoryDetail.setCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'quantity',
                    value: requestedQuantity
                });

                inventoryDetail.commitLine({
                    sublistId: 'inventoryassignment'
                });

                log.audit('Inventory Detail Added', {
                    sku: requestedSku,
                    itemId: itemId,
                    lotNumber: lotNumber,
                    quantity: requestedQuantity
                });

                /*
                 * Commit Credit Memo Line
                 */

                creditMemo.commitLine({
                    sublistId: 'item'
                });

                log.audit('Credit Memo Item Added', {
                    sku: requestedSku,
                    itemId: itemId,
                    quantity: requestedQuantity,
                    rate: requestedRate,
                    lotNumber: lotNumber
                });
            }

            /*
             * Save Credit Memo
             */

            var creditMemoId = creditMemo.save();

            log.audit('Credit Memo Created', {
                id: creditMemoId,
                customerId: customerId,
                locationId: locationId,
                itemCount: body.items.length
            });

            return sendJson(context, 200, {
                success: true,
                id: creditMemoId,
                customerId: Number(customerId),
                locationId: Number(locationId),
                message: 'Credit Memo created successfully.'
            });

        } catch (e) {

            log.error('CREDIT_MEMO_CREATE_ERROR', {
                name: e.name,
                message: e.message,
                stack: e.stack,
                body: body
            });

            return sendJson(context, 500, {
                success: false,
                code: 'CREDIT_MEMO_CREATE_ERROR',
                message: e && e.message
                    ? e.message
                    : 'Unexpected error while creating Credit Memo.'
            });
        }
    }

    function sendJson(context, status, obj) {

        context.response.addHeader({
            name: 'Content-Type',
            value: 'application/json'
        });

        context.response.status = status;

        context.response.write(
            JSON.stringify(obj)
        );
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