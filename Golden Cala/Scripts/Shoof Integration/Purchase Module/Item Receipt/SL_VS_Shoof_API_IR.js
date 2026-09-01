/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API IR
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

            log.audit('Shoof IR API - Incoming Request', requestBodyObject);

            var vendorInternalId = requestBodyObject.entity;
            if (!isNumericValue(vendorInternalId)) {
                return sendErrorResponse(responseObject, 'VALIDATION_ERROR', '"entity" (vendor internal ID) is mandatory and must be numeric.', {
                    entity: vendorInternalId
                });
            }
            vendorInternalId = parseInt(vendorInternalId, 10);

            if (!isNumericValue(requestBodyObject.createdfrom)) {
                return sendErrorResponse(responseObject, 'VALIDATION_ERROR', '"createdfrom" (PO internal ID) is mandatory and must be a number.');
            }
            var createdFromPurchaseOrderId = parseInt(requestBodyObject.createdfrom, 10);

            var receiptLines = Array.isArray(requestBodyObject.items) ? requestBodyObject.items : [];
            if (!receiptLines.length) {
                return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'At least one item line is required.', {
                    itemsExample: [{
                        id: "12345", quantity: 2,
                        inventoryAssignments: [{ inventoryNumber: "LOT-ABC", quantity: 2 }]
                    }]
                });
            }

            for (var i = 0; i < receiptLines.length; i++) {
                var line = receiptLines[i] || {};

                if (!line.id) {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Line: "id" (custitem_vs_sku) is required.', { line: i + 1 });
                }
                if (!isNumericValue(line.quantity)) {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Line: "quantity" must be a number.', { line: i + 1, quantity: line.quantity });
                }

                if (Array.isArray(line.inventoryAssignments) && line.inventoryAssignments.length) {

                    var totalAssigned = 0;

                    for (var a = 0; a < line.inventoryAssignments.length; a++) {
                        var assign = line.inventoryAssignments[a] || {};

                        if (!assign.inventoryNumber || String(assign.inventoryNumber).trim() == '') {
                            return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Each inventory assignment needs "inventoryNumber".', {
                                line: i + 1,
                                assignment: a + 1
                            });
                        }

                        if (!isNumericValue(assign.quantity)) {
                            return sendErrorResponse(responseObject, 'VALIDATION_ERROR', 'Each inventory assignment needs numeric "quantity".', {
                                line: i + 1,
                                assignment: a + 1
                            });
                        }

                        totalAssigned += parseFloat(assign.quantity);
                    }

                    if (Math.abs(totalAssigned - parseFloat(line.quantity)) > 1e-9) {
                        return sendErrorResponse(responseObject, 'VALIDATION_ERROR',
                            'Sum of inventoryAssignments.quantity must equal line.quantity.', {
                            line: i + 1,
                            quantity: line.quantity,
                            assignedTotal: totalAssigned
                        });
                    }
                }
            }

            log.audit('Shoof IR API - Header Resolved', {
                vendorInternalId: vendorInternalId,
                createdFromPurchaseOrderId: createdFromPurchaseOrderId,
                itemCount: receiptLines.length
            });

            var itemReceiptRecord = record.transform({
                fromType: record.Type.PURCHASE_ORDER,
                fromId: createdFromPurchaseOrderId,
                toType: record.Type.ITEM_RECEIPT,
                isDynamic: true
            });

            try {
                var poFields = search.lookupFields({
                    type: record.Type.PURCHASE_ORDER,
                    id: createdFromPurchaseOrderId,
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

            itemReceiptRecord.setValue({ fieldId: 'customform', value: 165 }); // Shoof Item Receipt form
            itemReceiptRecord.setValue({ fieldId: 'landedcostmethod', value: 'VALUE' });

            log.debug('landedCostFields', {
                landedCostCategory: requestBodyObject.LandedCostCategory,
                landedCostAmount: requestBodyObject.LandedCostAmount
            });

            if (requestBodyObject.LandedCostCategory && isNumericValue(requestBodyObject.LandedCostAmount)) {
                var landedCostMap = {
                    "Sea freight-Purchase expenses": "landedcostamount1",
                    "Customs clearance- Purchase Expenses": "landedcostamount2",
                    "Air Freight - Purchase Expenses": "landedcostamount3",
                    "Custom Duty - Purchase Expenses": "landedcostamount4",
                    "Demurrage charges - Purchase Expenses": "landedcostamount5",
                    "Local Transportation - Purchase Expenses": "landedcostamount6",
                    "Offloading Expenses - Purchase Espenses": "landedcostamount7",
                    "Demurrage charges Penalty - Purchase Expenses": "landedcostamount8",
                    "Marine Insurance - Purchase Expenses": "landedcostamount9",
                    "Detention charges Penalty - Purchase Expenses": "landedcostamount10",
                    "Shipping & Logistic Wagdy": "landedcostamount11",
                    "Air Way Bill (SAL Air Freight Clearance)": "landedcostamount12",
                };

                var landedCostFieldId = landedCostMap[requestBodyObject.LandedCostCategory];
                if (!landedCostFieldId) {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR',
                        'Invalid Landed Cost Category provided.', {
                        providedCategory: requestBodyObject.LandedCostCategory,
                        validCategories: Object.keys(landedCostMap)
                    });
                }

                itemReceiptRecord.setValue({
                    fieldId: landedCostFieldId,
                    value: parseFloat(requestBodyObject.LandedCostAmount)
                });

                log.audit('LANDED_COST_APPLIED', {
                    category: requestBodyObject.LandedCostCategory,
                    fieldId: landedCostFieldId,
                    amount: requestBodyObject.LandedCostAmount
                });
            }

            var payloadItemsMap = {};
            for (var p = 0; p < receiptLines.length; p++) {
                var itemInternalId = findItemInternalIdBySku(receiptLines[p].id);
                if (!itemInternalId) {
                    return sendErrorResponse(responseObject, 'VALIDATION_ERROR', `Item not found for custitem_vs_sku '${receiptLines[p].id}'`, {
                        line: p + 1,
                        id: receiptLines[p].id
                    });
                }
                payloadItemsMap[String(itemInternalId)] = receiptLines[p];
                receiptLines[p].resolvedItemId = itemInternalId;
            }

            var receiptLineCount = itemReceiptRecord.getLineCount({ sublistId: 'item' });

            for (var idx = 0; idx < receiptLineCount; idx++) {
                var lineItemId = parseInt(itemReceiptRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: idx
                }), 10);

                var payloadLine = payloadItemsMap[String(lineItemId)];

                if (!payloadLine) {
                    itemReceiptRecord.selectLine({ sublistId: 'item', line: idx });
                    itemReceiptRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemreceive',
                        value: false
                    });
                    itemReceiptRecord.commitLine({ sublistId: 'item' });
                    continue;
                }

                itemReceiptRecord.selectLine({ sublistId: 'item', line: idx });
                itemReceiptRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: true });
                itemReceiptRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: parseFloat(payloadLine.quantity) });

                var inventoryDetailSubrecord = null;

                try {
                    inventoryDetailSubrecord = itemReceiptRecord.getCurrentSublistSubrecord({
                        sublistId: 'item',
                        fieldId: 'inventorydetail'
                    });
                } catch (inventoryDetailError) {
                    log.debug('INVENTORY_DETAIL_NOT_AVAILABLE', {
                        line: idx + 1,
                        itemId: lineItemId,
                        error: inventoryDetailError
                    });
                }

                if (inventoryDetailSubrecord && Array.isArray(payloadLine.inventoryAssignments) && payloadLine.inventoryAssignments.length) {

                    try {
                        var existingAssignments = inventoryDetailSubrecord.getLineCount({
                            sublistId: 'inventoryassignment'
                        });

                        for (var r = existingAssignments - 1; r >= 0; r--) {
                            inventoryDetailSubrecord.removeLine({
                                sublistId: 'inventoryassignment',
                                line: r,
                                ignoreRecalc: true
                            });
                        }
                    } catch (clearErr) {
                        log.debug('ASSIGNMENTS_CLEAR_WARNING', clearErr);
                    }

                    for (var aa = 0; aa < payloadLine.inventoryAssignments.length; aa++) {
                        var payloadAssign = payloadLine.inventoryAssignments[aa];

                        inventoryDetailSubrecord.selectNewLine({
                            sublistId: 'inventoryassignment'
                        });

                        inventoryDetailSubrecord.setCurrentSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'receiptinventorynumber',
                            value: String(payloadAssign.inventoryNumber)
                        });

                        inventoryDetailSubrecord.setCurrentSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'quantity',
                            value: parseFloat(payloadAssign.quantity)
                        });

                        inventoryDetailSubrecord.commitLine({
                            sublistId: 'inventoryassignment'
                        });
                    }
                }

                itemReceiptRecord.commitLine({ sublistId: 'item' });
            }

            var itemReceiptInternalId = itemReceiptRecord.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            log.audit('IR_CREATED', { internalId: itemReceiptInternalId });

            var vendorBillInternalId = null;
            try {
                var vendorBillRecord = record.transform({
                    fromType: record.Type.PURCHASE_ORDER,
                    fromId: createdFromPurchaseOrderId,
                    toType: record.Type.VENDOR_BILL,
                    isDynamic: true
                });

                vendorBillRecord.setValue({ fieldId: 'customform', value: 164 }); // Shoof Bill
                vendorBillRecord.setValue({ fieldId: 'approvalstatus', value: 2 }); // Approved
                vendorBillInternalId = vendorBillRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });
                log.audit('VENDOR_BILL_CREATED', { internalId: vendorBillInternalId });
            } catch (billError) {
                log.error('BILL_CREATION_FAILED', billError);
            }

            // Fetch transaction IDs
            var itemReceiptTranId = '';
            try {
                var irLookup = search.lookupFields({
                    type: record.Type.ITEM_RECEIPT,
                    id: itemReceiptInternalId,
                    columns: ['tranid']
                });
                itemReceiptTranId = (irLookup && irLookup.tranid) || '';
            } catch (lookupError) {
                log.debug('TRANID_LOOKUP_WARNING', lookupError);
            }

            var vendorBillTranId = '';
            if (vendorBillInternalId) {
                try {
                    var billLookup = search.lookupFields({
                        type: record.Type.VENDOR_BILL,
                        id: vendorBillInternalId,
                        columns: ['tranid']
                    });
                    vendorBillTranId = (billLookup && billLookup.tranid) || '';
                } catch (billLookupError) {
                    log.debug('BILL_TRANID_LOOKUP_WARNING', billLookupError);
                }
            }

            return sendJsonResponse(responseObject, {
                success: true,
                recordType: 'itemreceipt',
                internalId: String(itemReceiptInternalId),
                tranId: itemReceiptTranId,
                vendorBillInternalId: vendorBillInternalId ? String(vendorBillInternalId) : null,
                vendorBillTranId: vendorBillTranId,
                warnings: []
            });

        } catch (unexpectedError) {
            log.error('SL_VS_Shoof_API_IR_UNEXPECTED_ERROR', {
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

    function findItemInternalIdBySku(skuValue) {
        var itemInternalId = null;
        var itemSearch = search.create({
            type: 'item',
            filters: [['custitem_vs_sku', 'is', skuValue]],
            columns: ['internalid']
        });
        itemSearch.run().each(function (result) {
            itemInternalId = result.getValue('internalid');
            return false;
        });
        return itemInternalId ? parseInt(itemInternalId, 10) : null;
    }

    function isNumericValue(value) {
        return value !== null && value !== '' && isFinite(parseFloat(value));
    }

    return { onRequest: onRequest };
});
