/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API SO
 */
define(['N/record', 'N/log', 'N/search'], function (record, log, search) {

    function onRequest(scriptContext) {
        var requestObject = scriptContext.request;
        var responseObject = scriptContext.response;

        if (requestObject.method !== 'POST') {
            return sendJsonResponse(responseObject, {
                success: false,
                code: 'METHOD_NOT_ALLOWED',
                message: 'Use POST with JSON body.'
            });
        }

        try {
            var requestBodyObject = {};
            try {
                requestBodyObject = JSON.parse(requestObject.body || '{}');
            } catch (parseError) {
                log.error('JSON_PARSE_ERROR', parseError);
                return sendErrorResponse(responseObject, 'INVALID_JSON', 'Request body must be valid JSON.');
            }

            log.audit('Shoof SO API - Incoming Request', requestBodyObject);

            var entityId = 2527; // Hardcoded customer

            if (!isNumericValue(requestBodyObject.location)) {
                return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Location is mandatory and must be a numeric internal ID.');
            }
            var locationId = parseInt(requestBodyObject.location, 10);

            var shoofTransactionId = requestBodyObject.custbody_vs_shoof_transaction_id || null;
            var shoofCustomer = requestBodyObject.custbody_vs_shoof_customer || null;
            var shoofSalesRep = requestBodyObject.custbody_vs_shoof_sales_rep || null;

            var soItems = Array.isArray(requestBodyObject.items) ? requestBodyObject.items : [];
            if (!soItems.length) {
                return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'At least one item line is required.', {
                    itemsExample: [{ sku: "ABC123", quantity: 1, rate: 100, taxable: "Yes", DiscountType: "01", DiscountAmount: "10" }]
                });
            }

            for (var i = 0; i < soItems.length; i++) {
                var line = soItems[i] || {};
                if (!line.sku) {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Line "sku" (custitem_vs_sku) is required.', { line: i + 1 });
                }
                if (!isNumericValue(line.quantity)) {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Line "quantity" must be numeric.', { line: i + 1, quantity: line.quantity });
                }
                if (!isNumericValue(line.rate)) {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Line "rate" must be numeric.', { line: i + 1, rate: line.rate });
                }
                if (line.taxable !== 'Yes' && line.taxable !== 'No') {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Line "taxable" must be Yes or No.', { line: i + 1, taxable: line.taxable });
                }
                if ((line.DiscountType && !line.DiscountAmount) || (!line.DiscountType && line.DiscountAmount)) {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Both "DiscountType" and "DiscountAmount" must be provided together.', { line: i + 1 });
                }
            }

            log.audit('Shoof SO API - Header Resolved', {
                entityId: entityId,
                locationId: locationId,
                shoofTransactionId: shoofTransactionId,
                shoofCustomer: shoofCustomer,
                shoofSalesRep: shoofSalesRep,
                itemCount: soItems.length
            });

            var soRecord = record.create({ type: record.Type.SALES_ORDER, isDynamic: true });

            soRecord.setValue({ fieldId: 'customform', value: 172 }); // Shoof Sales Order
            soRecord.setValue({ fieldId: 'entity', value: entityId });
            soRecord.setValue({ fieldId: 'orderstatus', value: 'B' }); // Pending Fulfillment
            soRecord.setValue({ fieldId: 'custbody_vs_shoof_transaction', value: true });
            soRecord.setValue({ fieldId: 'location', value: locationId });

            if (shoofTransactionId) {
                soRecord.setValue({ fieldId: 'custbody_vs_shoof_transaction_id', value: shoofTransactionId });
            }
            if (shoofCustomer) {
                soRecord.setValue({ fieldId: 'custbody_vs_shoof_customer', value: shoofCustomer });
            }
            if (shoofSalesRep) {
                soRecord.setValue({ fieldId: 'custbody_vs_shoof_sales_rep', value: shoofSalesRep });
            }

            for (var j = 0; j < soItems.length; j++) {
                var soLine = soItems[j];
                log.debug('Add Line', soLine);

                var itemId = findItemBySKU(soLine.sku);
                if (!itemId) {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Invalid SKU. Item not found.', { sku: soLine.sku });
                }

                // Normal item line
                soRecord.selectNewLine({ sublistId: 'item' });
                soRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemId });
                soRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: parseFloat(soLine.quantity) });
                soRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: parseFloat(soLine.rate) });

                var taxCode = (soLine.taxable === 'Yes') ? 6 : 7; // 6 is S-KSA and 7 is Z-KSA

                soRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'taxcode', value: taxCode });

                soRecord.commitLine({ sublistId: 'item' });

                // Discount line (if provided)
                if (soLine.DiscountType && soLine.DiscountAmount) {
                    var discountAmount = -Math.abs(parseFloat(soLine.DiscountAmount)); // always negative

                    soRecord.selectNewLine({ sublistId: 'item' });
                    soRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: parseInt(soLine.DiscountType, 10) });
                    soRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: discountAmount });
                    soRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'taxcode', value: 7 }); // Always 7 for discounts
                    soRecord.commitLine({ sublistId: 'item' });

                    log.debug('Discount Line Added', { DiscountType: soLine.DiscountType, DiscountAmount: discountAmount });
                }
            }

            var soInternalId = soRecord.save({ enableSourcing: true, ignoreMandatoryFields: false });

            log.audit('SO_CREATED', { internalId: soInternalId });

            var customerDepositId = null;
            if (requestBodyObject.customerdeposit && isNumericValue(requestBodyObject.customerdeposit.payment)) {
                var paymentAmount = parseFloat(requestBodyObject.customerdeposit.payment);

                var depositRecord = record.create({ type: record.Type.CUSTOMER_DEPOSIT, isDynamic: true });

                depositRecord.setValue({ fieldId: 'customer', value: entityId });
                depositRecord.setValue({ fieldId: 'salesorder', value: soInternalId });
                depositRecord.setValue({ fieldId: 'custbody_ksa_custmerdposit_tax_code', value: 6 });
                depositRecord.setValue({ fieldId: 'payment', value: paymentAmount });

                customerDepositId = depositRecord.save({ enableSourcing: true, ignoreMandatoryFields: false });

                log.audit('CUSTOMER_DEPOSIT_CREATED', { internalId: customerDepositId });
            }

            if (Array.isArray(requestBodyObject.paymentmethod)) {
                for (var p = 0; p < requestBodyObject.paymentmethod.length; p++) {
                    var pm = requestBodyObject.paymentmethod[p];
                    if (!pm.custrecord_vs_method || !isNumericValue(pm.custrecord_vs_payment_amount) || !pm.custrecord_vs_machine_id) {
                        log.error('PAYMENT_METHOD_VALIDATION_ERROR', pm);
                        continue;
                    }

                    var pmRecord = record.create({ type: 'customrecord_vs_payment_method', isDynamic: true });

                    pmRecord.setValue({ fieldId: 'custrecord_vs_so_reference', value: soInternalId });
                    pmRecord.setValue({ fieldId: 'custrecord_vs_method', value: pm.custrecord_vs_method });
                    pmRecord.setValue({ fieldId: 'custrecord_vs_payment_amount', value: parseFloat(pm.custrecord_vs_payment_amount) });
                    pmRecord.setValue({ fieldId: 'custrecord_vs_machine_id', value: pm.custrecord_vs_machine_id });

                    var pmId = pmRecord.save({ enableSourcing: true, ignoreMandatoryFields: false });
                    log.audit('PAYMENT_METHOD_CREATED', { internalId: pmId });
                }
            }

            return sendJsonResponse(responseObject, {
                success: true,
                recordType: 'salesorder',
                internalId: String(soInternalId),
                customerDepositId: customerDepositId ? String(customerDepositId) : null,
                warnings: []
            });

        } catch (unexpectedError) {
            log.error('SL_VS_Shoof_API_SO_UNEXPECTED_ERROR', {
                name: unexpectedError.name || '',
                message: unexpectedError.message || '',
                stack: unexpectedError.stack || ''
            });
            return sendJsonResponse(responseObject, {
                success: false,
                code: 'SERVER_ERROR',
                message: 'Unexpected error.',
                details: { name: unexpectedError.name || '', message: unexpectedError.message || '' }
            });
        }
    }

    function findItemBySKU(sku) {
        var itemSearch = search.create({
            type: 'item',
            filters: [['custitem_vs_sku', 'is', sku]],
            columns: ['internalid']
        });

        var itemId = null;
        itemSearch.run().each(function (result) {
            itemId = result.getValue('internalid');
            return false;
        });

        return itemId;
    }

    function sendJsonResponse(responseObject, responseBody) {
        try {
            responseObject.addHeader({ name: 'Content-Type', value: 'application/json' });
        } catch (headerError) {
            log.debug('HEADER_SET_WARNING', headerError);
        }
        responseObject.write(JSON.stringify(responseBody));
    }

    function sendErrorResponse(responseObject, errorCode, errorMessage, errorDetails) {
        return sendJsonResponse(responseObject, {
            success: false,
            code: errorCode,
            message: errorMessage,
            details: errorDetails || {}
        });
    }

    function isNumericValue(value) {
        return value !== null && value !== '' && isFinite(parseFloat(value));
    }

    return { onRequest: onRequest };
});
