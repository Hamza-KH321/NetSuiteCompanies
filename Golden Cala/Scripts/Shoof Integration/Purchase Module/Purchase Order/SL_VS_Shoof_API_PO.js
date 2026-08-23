/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API PO
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

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

            log.audit('Shoof PO API - Incoming Request', requestBodyObject);

            var vendorInternalId = requestBodyObject.entity;
            if (!isNumericValue(vendorInternalId)) {
                return sendErrorResponse(responseObject, 'VALIDATION_ERROR', '"entity" is mandatory and must be a numeric internal ID.', {
                    entity: vendorInternalId
                });
            }
            vendorInternalId = parseInt(vendorInternalId, 10);

            var locationId = requestBodyObject.location;
            if (!isNumericValue(locationId)) {
                return sendErrorResponse(responseObject, 'VALIDATION_ERROR', '"location" is mandatory and must be a numeric internal ID.', {
                    location: locationId
                });
            }
            locationId = parseInt(locationId, 10);

            var currencyIsoCode = requestBodyObject.currency;
            if (!currencyIsoCode || typeof currencyIsoCode !== 'string' || currencyIsoCode.trim() === '') {
                return sendErrorResponse(responseObject, 'VALIDATION_ERROR', '"currency" is mandatory and must be a valid ISO code (e.g. USD, SAR, AED).', {
                    currency: currencyIsoCode
                });
            }
            currencyIsoCode = currencyIsoCode.trim().toUpperCase();

            var currencyMap = {
                'SAR': 1,  // Saudi Riyal
                'USD': 2,  // US Dollar
                'CAD': 3,  // Canadian Dollar
                'EUR': 4,  // Euro
                'GBP': 5,  // British Pound
                'AED': 6,  // UAE Dirham
                'KWD': 7   // Kuwaiti Dinar
            };

            var currencyInternalId = currencyMap[currencyIsoCode];
            if (!currencyInternalId) {
                return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Unsupported currency code.', {
                    currency: currencyIsoCode,
                    supported: Object.keys(currencyMap)
                });
            }

            var shoofTransactionId = requestBodyObject.custbody_vs_shoof_transaction_id || null;

            var purchaseOrderItems = Array.isArray(requestBodyObject.items) ? requestBodyObject.items : [];
            if (!purchaseOrderItems.length) {
                return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'At least one item line is required.', {
                    itemsExample: [{ id: "12345", quantity: 1, rate: 10, taxable: "Yes" }]
                });
            }

            for (var lineValidationIndex = 0; lineValidationIndex < purchaseOrderItems.length; lineValidationIndex++) {
                var lineObj = purchaseOrderItems[lineValidationIndex] || {};

                if (!lineObj.id) {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Line item: "id" (custitem_vs_sku) is required.', {
                        line: lineValidationIndex + 1
                    });
                }
                if (!isNumericValue(lineObj.quantity)) {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Line item: "quantity" must be a number.', {
                        line: lineValidationIndex + 1,
                        quantity: lineObj.quantity
                    });
                }
                if (!isNumericValue(lineObj.rate)) {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Line item: "rate" must be a number.', {
                        line: lineValidationIndex + 1,
                        rate: lineObj.rate
                    });
                }
                if (!lineObj.taxable || !['yes', 'no'].includes(lineObj.taxable.toLowerCase())) {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Line item: "taxable" must be Yes or No.', {
                        line: lineValidationIndex + 1,
                        taxable: lineObj.taxable
                    });
                }
            }

            log.audit('Shoof PO API - Header Resolved', {
                vendorInternalId: vendorInternalId,
                locationId: locationId,
                currency: currencyIsoCode,
                currencyInternalId: currencyInternalId,
                shoofTransactionId: shoofTransactionId,
                itemCount: purchaseOrderItems.length
            });

            var purchaseOrderRecord = record.create({ type: record.Type.PURCHASE_ORDER, isDynamic: true });

            purchaseOrderRecord.setValue({ fieldId: 'customform', value: 167 }); // Shoof PO 
            purchaseOrderRecord.setValue({ fieldId: 'entity', value: vendorInternalId });
            purchaseOrderRecord.setValue({ fieldId: 'subsidiary', value: 2 }); // Golden Cala
            purchaseOrderRecord.setValue({ fieldId: 'custbody_vs_shoof_transaction', value: true });
            purchaseOrderRecord.setValue({ fieldId: 'approvalstatus', value: 2 }); // Approved
            purchaseOrderRecord.setValue({ fieldId: 'location', value: locationId });
            purchaseOrderRecord.setValue({ fieldId: 'currency', value: currencyInternalId }); // Use Internal ID

            if (shoofTransactionId) {
                purchaseOrderRecord.setValue({ fieldId: 'custbody_vs_shoof_transaction_id', value: shoofTransactionId });
            }

            for (var lineIndex = 0; lineIndex < purchaseOrderItems.length; lineIndex++) {
                var lineData = purchaseOrderItems[lineIndex];

                var itemIdText = findItemIdBySku(lineData.id);
                if (!itemIdText) {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR', `Item not found for custitem_vs_sku '${lineData.id}'`, {
                        line: lineIndex + 1,
                        id: lineData.id
                    });
                }

                log.debug('Add Line', {
                    line: lineIndex + 1,
                    sku: lineData.id,
                    itemIdText: itemIdText,
                    quantity: lineData.quantity,
                    rate: lineData.rate,
                    taxable: lineData.taxable
                });

                purchaseOrderRecord.selectNewLine({ sublistId: 'item' });
                purchaseOrderRecord.setCurrentSublistText({ sublistId: 'item', fieldId: 'item', text: itemIdText });
                purchaseOrderRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: parseFloat(lineData.quantity) });
                purchaseOrderRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: parseFloat(lineData.rate) });

                var taxCode = (lineData.taxable.toLowerCase() === 'yes') ? 10 : 11;
                purchaseOrderRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'taxcode', value: taxCode });

                purchaseOrderRecord.commitLine({ sublistId: 'item' });
            }

            var purchaseOrderInternalId = purchaseOrderRecord.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            log.audit('PO_CREATED', { internalId: purchaseOrderInternalId });

            var purchaseOrderTranId = '';
            try {
                var purchaseOrderLookup = search.lookupFields({
                    type: record.Type.PURCHASE_ORDER,
                    id: purchaseOrderInternalId,
                    columns: ['tranid']
                });
                purchaseOrderTranId = (purchaseOrderLookup && purchaseOrderLookup.tranid) || '';
            } catch (lookupError) {
                log.debug('TRANID_LOOKUP_WARNING', lookupError);
            }

            return sendJsonResponse(responseObject, {
                success: true,
                recordType: 'purchaseorder',
                internalId: String(purchaseOrderInternalId),
                tranId: purchaseOrderTranId,
                warnings: []
            });

        } catch (unexpectedError) {
            log.error('SL_VS_Shoof_API_PO_UNEXPECTED_ERROR', {
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

    function findItemIdBySku(skuValue) {
        var itemIdValue = null;
        var itemSearch = search.create({
            type: 'item',
            filters: [['custitem_vs_sku', 'is', skuValue]],
            columns: ['itemid']
        });
        itemSearch.run().each(function (result) {
            itemIdValue = result.getValue('itemid');
            return false;
        });
        return itemIdValue;
    }

    function isNumericValue(value) {
        return value !== null && value !== '' && isFinite(parseFloat(value));
    }

    return { onRequest: onRequest };
});
