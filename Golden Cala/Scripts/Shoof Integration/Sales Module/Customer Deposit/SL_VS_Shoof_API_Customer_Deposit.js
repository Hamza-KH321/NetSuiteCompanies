/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API Customer Deposit
 */

define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function onRequest(context) {

        context.response.setHeader({
            name: 'Content-Type',
            value: 'application/json'
        });

        if (context.request.method != 'POST') {

            context.response.write({
                output: JSON.stringify({
                    success: false,
                    error: 'METHOD_NOT_ALLOWED',
                    message: 'Only POST method is allowed.'
                })
            });

            return;
        }

        try {

            log.audit({
                title: 'CUSTOMER DEPOSIT API - START',
                details: 'Request received'
            });

            // ---------------------------------------------------------
            // Parse Request
            // ---------------------------------------------------------

            var requestBody;

            try {

                requestBody = JSON.parse(context.request.body);

                log.debug({
                    title: 'REQUEST BODY',
                    details: requestBody
                });

            } catch (e) {

                log.error({
                    title: 'INVALID JSON',
                    details: e
                });

                context.response.write({
                    output: JSON.stringify({
                        success: false,
                        error: 'INVALID_JSON',
                        message: 'Invalid JSON request body.'
                    })
                });

                return;
            }

            // ---------------------------------------------------------
            // Validate Sales Order
            // ---------------------------------------------------------

            var salesOrderId = requestBody.salesOrderId;

            if (!salesOrderId) {
                throw new Error(
                    'Missing required field: salesOrderId'
                );
            }

            // ---------------------------------------------------------
            // Validate Payment
            // ---------------------------------------------------------

            var paymentAmount = requestBody.payment;

            if (paymentAmount == null || paymentAmount == '') {
                throw new Error(
                    'Missing required field: payment'
                );
            }

            if (!isNumericValue(paymentAmount)) {
                throw new Error(
                    'Payment must be a numeric value.'
                );
            }

            paymentAmount = parseFloat(paymentAmount);

            if (paymentAmount <= 0) {
                throw new Error(
                    'Payment must be greater than zero.'
                );
            }

            log.debug({
                title: 'REQUEST VALIDATED',
                details: {
                    salesOrderId: salesOrderId,
                    paymentAmount: paymentAmount
                }
            });

            // ---------------------------------------------------------
            // Load Sales Order
            // ---------------------------------------------------------

            var salesOrderRec = record.load({
                type: record.Type.SALES_ORDER,
                id: salesOrderId,
                isDynamic: false
            });

            var customerId = salesOrderRec.getValue({
                fieldId: 'entity'
            });

            var salesOrderTranId = salesOrderRec.getValue({
                fieldId: 'tranid'
            });

            var salesOrderStatus = salesOrderRec.getValue({
                fieldId: 'status'
            });

            var salesOrderStatusRef = salesOrderRec.getValue({
                fieldId: 'statusref'
            });

            var salesOrderTotal = salesOrderRec.getValue({
                fieldId: 'total'
            });

            log.debug({
                title: 'SALES ORDER LOADED',
                details: {
                    salesOrderId: salesOrderId,
                    tranId: salesOrderTranId,
                    customerId: customerId,
                    total: salesOrderTotal,
                    status: salesOrderStatus,
                    statusRef: salesOrderStatusRef
                }
            });

            if (!customerId) {

                throw new Error(
                    'Customer is missing on Sales Order ' + salesOrderTranId
                );
            }

            // ---------------------------------------------------------
            // Check Invoice
            // ---------------------------------------------------------

            var invoiceInfo = findInvoiceFromSalesOrder(salesOrderId);

            log.debug({
                title: 'INVOICE CHECK',
                details: invoiceInfo
            });

            var depositId = null;
            var depositApplicationId = null;
            var invoiceId = null;
            var invoiceTranId = null;
            var appliedAmount = 0;

            // =========================================================
            // CASE 1:
            // SALES ORDER IS NOT BILLED
            // =========================================================

            if (!invoiceInfo.found) {

                log.debug({
                    title: 'UNBILLED SALES ORDER',
                    details: 'Creating deposit linked directly to Sales Order.'
                });

                var depositRec = record.create({
                    type: record.Type.CUSTOMER_DEPOSIT,
                    isDynamic: true
                });

                // Customer
                depositRec.setValue({
                    fieldId: 'customer',
                    value: customerId
                });

                // -----------------------------------------------------
                // Link Customer Deposit to Sales Order
                // -----------------------------------------------------

                depositRec.setValue({
                    fieldId: 'salesorder',
                    value: salesOrderId
                });

                log.debug({
                    title: 'SALES ORDER LINKED TO DEPOSIT',
                    details: {
                        salesOrderId: salesOrderId,
                        salesOrderTranId: salesOrderTranId
                    }
                });

                // Tax Code
                depositRec.setValue({
                    fieldId: 'custbody_ksa_custmerdposit_tax_code',
                    value: 6
                });

                // Payment
                depositRec.setValue({
                    fieldId: 'payment',
                    value: paymentAmount
                });

                // -----------------------------------------------------
                // Save Deposit
                // -----------------------------------------------------

                depositId = depositRec.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: false
                });

                log.audit({
                    title: 'CUSTOMER DEPOSIT CREATED',
                    details: {
                        depositId: depositId,
                        salesOrderId: salesOrderId,
                        salesOrderTranId: salesOrderTranId,
                        payment: paymentAmount
                    }
                });

            }

            // =========================================================
            // CASE 2:
            // SALES ORDER IS ALREADY BILLED
            // =========================================================

            else {

                invoiceId = invoiceInfo.internalId;
                invoiceTranId = invoiceInfo.tranId;

                log.debug({
                    title: 'BILLED SALES ORDER',
                    details: {
                        salesOrderId: salesOrderId,
                        salesOrderTranId: salesOrderTranId,
                        invoiceId: invoiceId,
                        invoiceTranId: invoiceTranId,
                        invoiceRemaining: invoiceInfo.amountRemaining
                    }
                });

                // -----------------------------------------------------
                // Validate Invoice Remaining Amount
                // -----------------------------------------------------

                var invoiceRemaining = parseFloat(
                    invoiceInfo.amountRemaining
                );

                if (isNaN(invoiceRemaining)) {
                    invoiceRemaining = 0;
                }

                if (invoiceRemaining <= 0) {

                    throw new Error(
                        'Invoice ' + invoiceTranId +
                        ' is already fully paid. No remaining amount is available for this deposit.'
                    );
                }

                if (paymentAmount > invoiceRemaining) {

                    throw new Error(
                        'Payment amount ' + paymentAmount +
                        ' is greater than the remaining amount of Invoice ' +
                        invoiceTranId +
                        ' (' + invoiceRemaining + ').'
                    );
                }

                // -----------------------------------------------------
                // Create Customer Deposit WITHOUT Sales Order
                // -----------------------------------------------------

                log.debug({
                    title: 'CREATING UNLINKED CUSTOMER DEPOSIT',
                    details: {
                        customerId: customerId,
                        payment: paymentAmount
                    }
                });

                var billedDepositRec = record.create({
                    type: record.Type.CUSTOMER_DEPOSIT,
                    isDynamic: true
                });

                billedDepositRec.setValue({
                    fieldId: 'customer',
                    value: customerId
                });

                // DO NOT SET SALESORDER HERE
                //
                // The Sales Order is already billed.
                // The deposit will be applied to the invoice.

                billedDepositRec.setValue({
                    fieldId: 'custbody_ksa_custmerdposit_tax_code',
                    value: 6
                });

                billedDepositRec.setValue({
                    fieldId: 'payment',
                    value: paymentAmount
                });

                // -----------------------------------------------------
                // Save Deposit
                // -----------------------------------------------------

                depositId = billedDepositRec.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: false
                });

                log.audit({
                    title: 'CUSTOMER DEPOSIT CREATED',
                    details: {
                        depositId: depositId,
                        customerId: customerId,
                        payment: paymentAmount,
                        invoiceId: invoiceId,
                        invoiceTranId: invoiceTranId
                    }
                });

                // -----------------------------------------------------
                // Transform Customer Deposit -> Deposit Application
                // -----------------------------------------------------

                log.debug({
                    title: 'CREATING DEPOSIT APPLICATION',
                    details: {
                        depositId: depositId,
                        invoiceId: invoiceId,
                        amount: paymentAmount
                    }
                });

                var depositApplication = record.transform({
                    fromType: record.Type.CUSTOMER_DEPOSIT,
                    fromId: depositId,
                    toType: record.Type.DEPOSIT_APPLICATION,
                    isDynamic: false
                });

                var applyLineCount = depositApplication.getLineCount({
                    sublistId: 'apply'
                });

                log.debug({
                    title: 'DEPOSIT APPLICATION LINES',
                    details: applyLineCount
                });

                var invoiceFoundOnApply = false;

                for (var a = 0; a < applyLineCount; a++) {

                    var applyInternalId = depositApplication.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'internalid',
                        line: a
                    });

                    var applyDoc = depositApplication.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'doc',
                        line: a
                    });

                    log.debug({
                        title: 'CHECKING APPLY LINE',
                        details: {
                            line: a,
                            internalId: applyInternalId,
                            doc: applyDoc,
                            targetInvoice: invoiceId
                        }
                    });

                    if (
                        String(applyInternalId) == String(invoiceId) ||
                        String(applyDoc) == String(invoiceId)
                    ) {

                        depositApplication.setSublistValue({
                            sublistId: 'apply',
                            fieldId: 'apply',
                            value: true,
                            line: a
                        });

                        depositApplication.setSublistValue({
                            sublistId: 'apply',
                            fieldId: 'amount',
                            value: paymentAmount,
                            line: a
                        });

                        invoiceFoundOnApply = true;
                        appliedAmount = paymentAmount;

                        log.debug({
                            title: 'INVOICE MARKED FOR APPLICATION',
                            details: {
                                line: a,
                                invoiceId: invoiceId,
                                amount: paymentAmount
                            }
                        });

                        break;
                    }
                }

                if (!invoiceFoundOnApply) {

                    throw new Error(
                        'Invoice ' + invoiceTranId +
                        ' was not found on the Deposit Application.'
                    );
                }

                // -----------------------------------------------------
                // Save Deposit Application
                // -----------------------------------------------------

                depositApplicationId = depositApplication.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: false
                });

                log.audit({
                    title: 'DEPOSIT APPLICATION CREATED',
                    details: {
                        depositApplicationId: depositApplicationId,
                        depositId: depositId,
                        invoiceId: invoiceId,
                        invoiceTranId: invoiceTranId,
                        appliedAmount: appliedAmount
                    }
                });
            }

            // ---------------------------------------------------------
            // Create Payment Method Records
            // ---------------------------------------------------------

            var paymentMethodIds = [];

            if (Array.isArray(requestBody.paymentmethod)) {

                log.debug({
                    title: 'PAYMENT METHODS',
                    details: 'Found ' +
                        requestBody.paymentmethod.length +
                        ' payment method(s).'
                });

                for (
                    var p = 0;
                    p < requestBody.paymentmethod.length;
                    p++
                ) {

                    try {

                        var pm = requestBody.paymentmethod[p];

                        log.debug({
                            title: 'PROCESSING PAYMENT METHOD',
                            details: pm
                        });

                        if (
                            !pm.custrecord_vs_method ||
                            !isNumericValue(
                                pm.custrecord_vs_payment_amount
                            ) ||
                            !pm.custrecord_vs_machine_id
                        ) {

                            log.error({
                                title: 'PAYMENT METHOD VALIDATION ERROR',
                                details: pm
                            });

                            continue;
                        }

                        var pmAmount = parseFloat(
                            pm.custrecord_vs_payment_amount
                        );

                        var pmRecord = record.create({
                            type: 'customrecord_vs_payment_method',
                            isDynamic: true
                        });

                        // Reference to Customer Deposit
                        pmRecord.setValue({
                            fieldId: 'custrecord_vs_so_reference',
                            value: depositId
                        });

                        pmRecord.setValue({
                            fieldId: 'custrecord_vs_method',
                            value: pm.custrecord_vs_method
                        });

                        pmRecord.setValue({
                            fieldId: 'custrecord_vs_payment_amount',
                            value: pmAmount
                        });

                        pmRecord.setValue({
                            fieldId: 'custrecord_vs_machine_id',
                            value: pm.custrecord_vs_machine_id
                        });

                        var pmId = pmRecord.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: false
                        });

                        paymentMethodIds.push(pmId);

                        log.audit({
                            title: 'PAYMENT METHOD CREATED',
                            details: {
                                internalId: pmId,
                                depositId: depositId,
                                amount: pmAmount
                            }
                        });

                    } catch (pmError) {

                        log.error({
                            title: 'PAYMENT METHOD ERROR',
                            details: {
                                index: p,
                                error: pmError
                            }
                        });
                    }
                }
            }

            // ---------------------------------------------------------
            // Final Response
            // ---------------------------------------------------------

            log.audit({
                title: 'CUSTOMER DEPOSIT API - SUCCESS',
                details: {
                    salesOrderId: salesOrderId,
                    salesOrderTranId: salesOrderTranId,
                    depositId: depositId,
                    depositApplicationId: depositApplicationId,
                    invoiceId: invoiceId,
                    invoiceTranId: invoiceTranId,
                    payment: paymentAmount,
                    appliedAmount: appliedAmount,
                    paymentMethodIds: paymentMethodIds
                }
            });

            context.response.write({
                output: JSON.stringify({
                    success: true,
                    message: depositApplicationId
                        ? 'Customer Deposit created and applied to Invoice successfully.'
                        : 'Customer Deposit created and linked to Sales Order successfully.',
                    salesOrderId: salesOrderId,
                    salesOrderTranId: salesOrderTranId,
                    depositId: depositId,
                    depositApplicationId: depositApplicationId,
                    invoiceId: invoiceId,
                    invoiceTranId: invoiceTranId,
                    payment: paymentAmount,
                    appliedAmount: appliedAmount,
                    linkedToSalesOrder: depositApplicationId == null,
                    appliedToInvoice: depositApplicationId != null,
                    paymentMethodIds: paymentMethodIds
                })
            });

        } catch (e) {

            log.error({
                title: 'CUSTOMER DEPOSIT API ERROR',
                details: {
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                }
            });

            context.response.write({
                output: JSON.stringify({
                    success: false,
                    error: e.name || 'UNEXPECTED_ERROR',
                    message: e.message || e
                })
            });
        }
    }

    // -------------------------------------------------------------
    // Find Invoice Created From Sales Order
    // -------------------------------------------------------------

    function findInvoiceFromSalesOrder(salesOrderId) {

        try {

            var invoiceSearch = search.create({
                type: search.Type.TRANSACTION,
                filters: [
                    ['createdfrom', 'anyof', salesOrderId],
                    'AND',
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['type', 'anyof', 'CustInvc'],
                    'AND',
                    ['status', 'anyof', 'CustInvc:A']
                ],
                columns: [
                    search.createColumn({
                        name: 'internalid'
                    }),
                    search.createColumn({
                        name: 'tranid'
                    }),
                    search.createColumn({
                        name: 'amountremaining'
                    })
                ]
            });

            var results = invoiceSearch.run().getRange({
                start: 0,
                end: 1
            });

            if (results.length == 0) {

                // Search again without the open status filter.
                // This allows us to return a better message if the
                // invoice exists but is already fully paid.

                var allInvoiceSearch = search.create({
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
                        }),
                        search.createColumn({
                            name: 'amountremaining'
                        })
                    ]
                });

                var allResults = allInvoiceSearch.run().getRange({
                    start: 0,
                    end: 1
                });

                if (allResults.length == 0) {

                    return {
                        found: false
                    };
                }

                return {
                    found: true,
                    internalId: allResults[0].getValue({
                        name: 'internalid'
                    }),
                    tranId: allResults[0].getValue({
                        name: 'tranid'
                    }),
                    amountRemaining: allResults[0].getValue({
                        name: 'amountremaining'
                    })
                };
            }

            return {
                found: true,
                internalId: results[0].getValue({
                    name: 'internalid'
                }),
                tranId: results[0].getValue({
                    name: 'tranid'
                }),
                amountRemaining: results[0].getValue({
                    name: 'amountremaining'
                })
            };

        } catch (e) {

            log.error({
                title: 'FIND INVOICE ERROR',
                details: {
                    salesOrderId: salesOrderId,
                    error: e
                }
            });

            throw e;
        }
    }

    // -------------------------------------------------------------
    // Numeric Validation
    // -------------------------------------------------------------

    function isNumericValue(value) {

        return value != null &&
            value != '' &&
            isFinite(parseFloat(value));
    }

    return {
        onRequest: onRequest
    };
});