/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API SO Quantity Update
 */

define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function onRequest(context) {

        try {

            log.audit({
                title: 'SO Quantity Update API - Start',
                details: 'Request Method: ' + context.request.method
            });

            if (context.request.method != 'POST') {

                context.response.setHeader({
                    name: 'Content-Type',
                    value: 'application/json'
                });

                context.response.write(JSON.stringify({
                    success: false,
                    error: 'METHOD_NOT_ALLOWED',
                    message: 'Only POST method is allowed.'
                }));

                return;
            }

            context.response.setHeader({
                name: 'Content-Type',
                value: 'application/json'
            });

            var requestBody;

            try {

                requestBody = JSON.parse(context.request.body);

                log.debug({
                    title: 'Request Body',
                    details: requestBody
                });

            } catch (e) {

                log.error({
                    title: 'Invalid JSON',
                    details: e
                });

                context.response.write(JSON.stringify({
                    success: false,
                    error: 'INVALID_JSON',
                    message: 'Invalid JSON request body.'
                }));

                return;
            }

            // ---------------------------------------------------------
            // Validate Sales Order ID
            // ---------------------------------------------------------

            if (!requestBody.salesOrderId) {

                context.response.write(JSON.stringify({
                    success: false,
                    error: 'MISSING_SALES_ORDER_ID',
                    message: 'Sales Order internal ID is required.'
                }));

                return;
            }

            var salesOrderId = requestBody.salesOrderId;

            log.debug({
                title: 'Sales Order ID',
                details: salesOrderId
            });

            // ---------------------------------------------------------
            // Validate Items
            // ---------------------------------------------------------

            if (!requestBody.items) {

                context.response.write(JSON.stringify({
                    success: false,
                    error: 'MISSING_ITEMS',
                    message: 'Items array is required.'
                }));

                return;
            }

            if (!Array.isArray(requestBody.items)) {

                context.response.write(JSON.stringify({
                    success: false,
                    error: 'INVALID_ITEMS',
                    message: 'Items must be an array.'
                }));

                return;
            }

            if (requestBody.items.length == 0) {

                context.response.write(JSON.stringify({
                    success: false,
                    error: 'EMPTY_ITEMS',
                    message: 'At least one item is required.'
                }));

                return;
            }

            // ---------------------------------------------------------
            // Validate Request Items
            // ---------------------------------------------------------

            var requestItems = {};
            var validationErrors = [];

            for (var i = 0; i < requestBody.items.length; i++) {

                var requestItem = requestBody.items[i];

                if (!requestItem.sku) {

                    validationErrors.push(
                        'Item at index ' + i + ' is missing sku.'
                    );

                    continue;
                }

                if (requestItem.newqty == null || requestItem.newqty == '') {

                    validationErrors.push(
                        'New quantity is required for SKU ' + requestItem.sku + '.'
                    );

                    continue;
                }

                var newQty = Number(requestItem.newqty);

                if (isNaN(newQty)) {

                    validationErrors.push(
                        'New quantity must be numeric for SKU ' + requestItem.sku + '.'
                    );

                    continue;
                }

                if (newQty <= 0) {

                    validationErrors.push(
                        'New quantity must be greater than zero for SKU ' + requestItem.sku + '.'
                    );

                    continue;
                }

                if (requestItems[requestItem.sku]) {

                    validationErrors.push(
                        'Duplicate SKU found in request: ' + requestItem.sku
                    );

                    continue;
                }

                requestItems[requestItem.sku] = {
                    sku: requestItem.sku,
                    newqty: newQty
                };
            }

            if (validationErrors.length > 0) {

                log.error({
                    title: 'Request Validation Error',
                    details: validationErrors
                });

                context.response.write(JSON.stringify({
                    success: false,
                    error: 'VALIDATION_ERROR',
                    message: validationErrors.join(' ')
                }));

                return;
            }

            // ---------------------------------------------------------
            // Check Sales Order Exists
            // ---------------------------------------------------------

            var salesOrderLookup;

            try {

                salesOrderLookup = search.lookupFields({
                    type: search.Type.SALES_ORDER,
                    id: salesOrderId,
                    columns: [
                        'tranid',
                        'statusref'
                    ]
                });

            } catch (e) {

                log.error({
                    title: 'Sales Order Not Found',
                    details: e
                });

                context.response.write(JSON.stringify({
                    success: false,
                    error: 'SALES_ORDER_NOT_FOUND',
                    message: 'Sales Order ' + salesOrderId + ' was not found.'
                }));

                return;
            }

            var salesOrderTranId = salesOrderLookup.tranid;

            log.debug({
                title: 'Sales Order Found',
                details: {
                    internalId: salesOrderId,
                    tranId: salesOrderTranId,
                    status: salesOrderLookup.statusref
                }
            });

            // ---------------------------------------------------------
            // Check Invoice
            // ---------------------------------------------------------

            var invoiceSearch = search.create({
                type: search.Type.TRANSACTION,
                filters: [
                    ['createdfrom', 'anyof', salesOrderId],
                    'AND',
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['type', 'anyof', 'CustInvc']
                ],
                columns: [
                    search.createColumn({
                        name: 'internalid'
                    }),
                    search.createColumn({
                        name: 'tranid'
                    })
                ]
            });

            var invoiceResults = invoiceSearch.run().getRange({
                start: 0,
                end: 10
            });

            log.debug({
                title: 'Invoice Check',
                details: 'Found ' + invoiceResults.length + ' invoice(s).'
            });

            // ---------------------------------------------------------
            // Reject if Invoice Exists
            // ---------------------------------------------------------

            if (invoiceResults.length > 0) {

                var invoiceIds = [];

                for (var inv = 0; inv < invoiceResults.length; inv++) {

                    invoiceIds.push(
                        invoiceResults[inv].getValue({
                            name: 'internalid'
                        })
                    );
                }

                log.error({
                    title: 'SO Cannot Be Updated',
                    details: {
                        salesOrderId: salesOrderId,
                        invoiceIds: invoiceIds
                    }
                });

                context.response.write(JSON.stringify({
                    success: false,
                    error: 'SALES_ORDER_ALREADY_INVOICED',
                    message: 'Sales Order ' + salesOrderTranId +
                        ' has been invoiced and cannot be updated.',
                    salesOrderId: salesOrderId,
                    tranId: salesOrderTranId,
                    invoiceExists: true,
                    invoiceIds: invoiceIds
                }));

                return;
            }

            // ---------------------------------------------------------
            // Load Sales Order
            // ---------------------------------------------------------

            log.debug({
                title: 'Loading Sales Order',
                details: salesOrderId
            });

            var salesOrder = record.load({
                type: record.Type.SALES_ORDER,
                id: salesOrderId,
                isDynamic: true
            });

            var lineCount = salesOrder.getLineCount({
                sublistId: 'item'
            });

            log.debug({
                title: 'Sales Order Line Count',
                details: lineCount
            });

            // ---------------------------------------------------------
            // Find and Validate Requested Items
            // ---------------------------------------------------------

            var updatedItems = [];
            var notFoundItems = [];
            var quantityErrors = [];

            for (var r = 0; r < requestBody.items.length; r++) {

                var currentRequestItem = requestBody.items[r];

                var requestedSku = currentRequestItem.sku;
                var requestedQty = Number(currentRequestItem.newqty);

                var itemFound = false;

                for (var line = 0; line < lineCount; line++) {

                    var itemId = salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: line
                    });

                    if (!itemId) {
                        continue;
                    }

                    var sku = getSkuByItemId(itemId);

                    log.debug({
                        title: 'Checking SO Line',
                        details: {
                            line: line,
                            itemId: itemId,
                            sku: sku,
                            requestedSku: requestedSku
                        }
                    });

                    if (sku == requestedSku) {

                        itemFound = true;

                        // -------------------------------------------------
                        // Get Current Quantity
                        // -------------------------------------------------

                        var oldQty = Number(salesOrder.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            line: line
                        })) || 0;

                        // -------------------------------------------------
                        // Get Fulfilled Quantity
                        // -------------------------------------------------

                        var fulfilledQty = Number(salesOrder.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantityfulfilled',
                            line: line
                        })) || 0;

                        // -------------------------------------------------
                        // Calculate Remaining Quantity
                        // -------------------------------------------------

                        var remainingQty = oldQty - fulfilledQty;

                        if (remainingQty < 0) {
                            remainingQty = 0;
                        }

                        log.debug({
                            title: 'Quantity Validation',
                            details: {
                                line: line,
                                sku: requestedSku,
                                currentQuantity: oldQty,
                                fulfilledQuantity: fulfilledQty,
                                remainingQuantity: remainingQty,
                                requestedNewQuantity: requestedQty
                            }
                        });

                        // -------------------------------------------------
                        // Validate New Quantity
                        // -------------------------------------------------

                        if (requestedQty > remainingQty) {

                            quantityErrors.push({
                                sku: requestedSku,
                                line: line,
                                currentQuantity: oldQty,
                                fulfilledQuantity: fulfilledQty,
                                remainingQuantity: remainingQty,
                                requestedNewQuantity: requestedQty
                            });

                            log.error({
                                title: 'New Quantity Exceeds Remaining Quantity',
                                details: {
                                    sku: requestedSku,
                                    line: line,
                                    currentQuantity: oldQty,
                                    fulfilledQuantity: fulfilledQty,
                                    remainingQuantity: remainingQty,
                                    requestedNewQuantity: requestedQty
                                }
                            });

                            break;
                        }

                        // -------------------------------------------------
                        // Update Quantity
                        // -------------------------------------------------

                        log.debug({
                            title: 'Updating Quantity',
                            details: {
                                line: line,
                                sku: requestedSku,
                                oldQty: oldQty,
                                fulfilledQty: fulfilledQty,
                                remainingQty: remainingQty,
                                newQty: requestedQty
                            }
                        });

                        salesOrder.selectLine({
                            sublistId: 'item',
                            line: line
                        });

                        salesOrder.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: requestedQty
                        });

                        salesOrder.commitLine({
                            sublistId: 'item'
                        });

                        updatedItems.push({
                            sku: requestedSku,
                            line: line,
                            oldqty: oldQty,
                            fulfilledqty: fulfilledQty,
                            remainingqty: remainingQty,
                            newqty: requestedQty
                        });

                        break;
                    }
                }

                if (!itemFound) {

                    notFoundItems.push(requestedSku);
                }
            }

            // ---------------------------------------------------------
            // Validate Requested Items Were Found
            // ---------------------------------------------------------

            if (notFoundItems.length > 0) {

                log.error({
                    title: 'Items Not Found On Sales Order',
                    details: notFoundItems
                });

                context.response.write(JSON.stringify({
                    success: false,
                    error: 'ITEM_NOT_FOUND_ON_SALES_ORDER',
                    message: 'The following SKU(s) were not found on Sales Order ' +
                        salesOrderTranId + ': ' +
                        notFoundItems.join(', '),
                    salesOrderId: salesOrderId,
                    tranId: salesOrderTranId,
                    itemsNotFound: notFoundItems
                }));

                return;
            }

            // ---------------------------------------------------------
            // Validate Quantity
            // ---------------------------------------------------------

            if (quantityErrors.length > 0) {

                var quantityErrorMessages = [];

                for (var q = 0; q < quantityErrors.length; q++) {

                    var quantityError = quantityErrors[q];

                    quantityErrorMessages.push(
                        'SKU ' + quantityError.sku +
                        ': current quantity is ' + quantityError.currentQuantity +
                        ', fulfilled quantity is ' + quantityError.fulfilledQuantity +
                        ', remaining quantity is ' + quantityError.remainingQuantity +
                        ', but requested new quantity is ' + quantityError.requestedNewQuantity + '.'
                    );
                }

                log.error({
                    title: 'Quantity Validation Failed',
                    details: quantityErrors
                });

                context.response.write(JSON.stringify({
                    success: false,
                    error: 'QUANTITY_EXCEEDS_REMAINING',
                    message: quantityErrorMessages.join(' '),
                    salesOrderId: salesOrderId,
                    tranId: salesOrderTranId,
                    items: quantityErrors
                }));

                return;
            }

            // ---------------------------------------------------------
            // Save Sales Order
            // ---------------------------------------------------------

            log.debug({
                title: 'Saving Sales Order',
                details: updatedItems
            });

            var savedSalesOrderId = salesOrder.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            log.audit({
                title: 'Sales Order Updated Successfully',
                details: {
                    salesOrderId: savedSalesOrderId,
                    tranId: salesOrderTranId,
                    updatedItems: updatedItems
                }
            });

            // ---------------------------------------------------------
            // Response
            // ---------------------------------------------------------

            context.response.write(JSON.stringify({
                success: true,
                message: 'Sales Order quantities updated successfully.',
                salesOrderId: savedSalesOrderId,
                tranId: salesOrderTranId,
                updatedItems: updatedItems
            }));

        } catch (e) {

            log.error({
                title: 'SO Quantity Update API Error',
                details: {
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                }
            });

            context.response.write(JSON.stringify({
                success: false,
                error: e.name || 'UNEXPECTED_ERROR',
                message: e.message ||
                    'Unexpected error occurred while updating the Sales Order.'
            }));
        }
    }

    // -------------------------------------------------------------
    // Find SKU Using custitem_vs_sku
    // -------------------------------------------------------------

    function getSkuByItemId(itemId) {

        try {

            var itemSearch = search.create({
                type: search.Type.ITEM,
                filters: [
                    ['internalid', 'anyof', itemId]
                ],
                columns: [
                    search.createColumn({
                        name: 'custitem_vs_sku'
                    })
                ]
            });

            var result = itemSearch.run().getRange({
                start: 0,
                end: 1
            });

            if (result.length == 0) {
                return '';
            }

            return result[0].getValue({
                name: 'custitem_vs_sku'
            });

        } catch (e) {

            log.error({
                title: 'Get SKU Error',
                details: {
                    itemId: itemId,
                    error: e
                }
            });

            return '';
        }
    }

    return {
        onRequest: onRequest
    };
});