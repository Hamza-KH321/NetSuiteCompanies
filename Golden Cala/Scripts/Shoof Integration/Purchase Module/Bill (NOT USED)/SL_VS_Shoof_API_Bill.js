/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
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

            log.audit('Shoof Bill API - Incoming Request', requestBodyObject);

            // ===== Validation =====
            var vendorNameInput = (requestBodyObject.entity || '').toString().trim();
            if (!vendorNameInput) {
                return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Vendor (entity) is mandatory and must be the Vendor name.');
            }
            var vendorInternalId = findVendorInternalIdByExactName(vendorNameInput);
            if (!vendorInternalId) {
                return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Vendor not found by name.', { entity: vendorNameInput });
            }

            if (!isNumericValue(requestBodyObject.createdfrom)) {
                return sendErrorResponse(responseObject, 'VALIDATION_ERROR', '"createdfrom" (PO internal ID) is mandatory and must be a number.');
            }
            var createdFromPOId = parseInt(requestBodyObject.createdfrom, 10);

            var itemReceiptsFilter = Array.isArray(requestBodyObject.itemreceipts) ? requestBodyObject.itemreceipts.map(Number) : [];
            if (!itemReceiptsFilter.length) {
                return sendErrorResponse(responseObject, 'VALIDATION_ERROR', '"itemreceipts" is mandatory and must contain at least one Item Receipt ID.');
            }

            // ===== Collect billable items from Item Receipts =====
            var billableMap = {};
            itemReceiptsFilter.forEach(function (irId) {
                try {
                    var irRecord = record.load({ type: record.Type.ITEM_RECEIPT, id: irId });
                    var lineCount = irRecord.getLineCount({ sublistId: 'item' });
                    for (var i = 0; i < lineCount; i++) {
                        var itemId = irRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                        var qty = parseFloat(irRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i })) || 0;
                        if (itemId && qty > 0) {
                            billableMap[itemId] = (billableMap[itemId] || 0) + qty;
                        }
                    }
                } catch (irErr) {
                    log.error('IR_LOAD_ERROR', { id: irId, error: irErr });
                }
            });

            log.audit('Billable Map from IRs', billableMap);

            // ===== Transform PO -> Vendor Bill =====
            var billRecord = record.transform({
                fromType: record.Type.PURCHASE_ORDER,
                fromId: createdFromPOId,
                toType: record.Type.VENDOR_BILL,
                isDynamic: true
            });

            // Validate PO vendor
            try {
                var poFields = search.lookupFields({
                    type: record.Type.PURCHASE_ORDER,
                    id: createdFromPOId,
                    columns: ['entity']
                });
                var poVendorId = poFields.entity && poFields.entity.length ? parseInt(poFields.entity[0].value, 10) : null;
                if (poVendorId !== vendorInternalId) {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR',
                        'The provided vendor does not match the Purchase Order vendor.',
                        { poVendorId: poVendorId, payloadVendorId: vendorInternalId });
                }
            } catch (vendorCheckError) {
                log.debug('PO_VENDOR_VALIDATION_WARNING', vendorCheckError);
            }

            // Set approval status = Approved
            billRecord.setValue({ fieldId: 'approvalstatus', value: 2 });

            // ===== Prune Bill Lines =====
            var lineCount = billRecord.getLineCount({ sublistId: 'item' });
            for (var i = lineCount - 1; i >= 0; i--) {
                var itemId = billRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                var qtyOnBill = parseFloat(billRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i })) || 0;

                if (!billableMap[itemId]) {
                    // Remove line if item not in IRs
                    billRecord.removeLine({ sublistId: 'item', line: i });
                } else {
                    // Adjust quantity if needed
                    var allowedQty = billableMap[itemId];
                    if (qtyOnBill > allowedQty) {
                        billRecord.selectLine({ sublistId: 'item', line: i });
                        billRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: allowedQty });
                        billRecord.commitLine({ sublistId: 'item' });
                    }
                    // After billing, consume from map
                    billableMap[itemId] -= Math.min(qtyOnBill, allowedQty);
                }
            }

            var billInternalId = billRecord.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            log.audit('BILL_CREATED', { internalId: billInternalId });

            // Fetch transaction ID
            var billTranId = '';
            try {
                var billLookup = search.lookupFields({
                    type: record.Type.VENDOR_BILL,
                    id: billInternalId,
                    columns: ['tranid']
                });
                billTranId = (billLookup && billLookup.tranid) || '';
            } catch (lookupError) {
                log.debug('TRANID_LOOKUP_WARNING', lookupError);
            }

            return sendJsonResponse(responseObject, {
                success: true,
                recordType: 'vendorbill',
                internalId: String(billInternalId),
                tranId: billTranId,
                warnings: []
            });

        } catch (unexpectedError) {
            log.error('SL_VS_Shoof_API_Bill_UNEXPECTED_ERROR', {
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

    // ===========================
    // Helper functions
    // ===========================

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

    function findVendorInternalIdByExactName(vendorName) {
        if (!vendorName) return null;
        var vendorInternalId = null;

        var vendorSearchByEntityId = search.create({
            type: 'vendor',
            filters: [['isinactive', 'is', 'F'], 'AND', ['entityid', 'is', vendorName]],
            columns: ['internalid']
        });
        vendorSearchByEntityId.run().each(function (result) {
            vendorInternalId = result.getValue('internalid');
            return false;
        });

        if (!vendorInternalId) {
            var vendorSearchByCompanyName = search.create({
                type: 'vendor',
                filters: [['isinactive', 'is', 'F'], 'AND', ['companyname', 'is', vendorName]],
                columns: ['internalid']
            });
            vendorSearchByCompanyName.run().each(function (result) {
                vendorInternalId = result.getValue('internalid');
                return false;
            });
        }
        return vendorInternalId ? parseInt(vendorInternalId, 10) : null;
    }

    function isNumericValue(value) {
        return value !== null && value !== '' && isFinite(parseFloat(value));
    }

    return { onRequest: onRequest };
});
