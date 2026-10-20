
/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || RMA Delete Zero Items
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/search', 'N/ui/dialog', 'N/log'],
    function (currentRecord, search, dialog, log) {

        var SUBLIST = 'item';
        var INV_DETAIL_FIELD = 'inventorydetail';
        var INV_ASSIGNMENT = 'inventoryassignment';
        var FLAG_FIELD = 'custbody_vs_fill_remaining_qty';

        function pageInit(context) {
            try {
                log.debug({
                    title: 'RMA Client Script',
                    details: 'Initialized successfully'
                });
            } catch (e) {
                log.error({
                    title: 'pageInit Error',
                    details: e.message || String(e)
                });
            }
        }

        /**
         * Calculates quantities consumed by other RMAs originating
         * from the same source transaction.
         *
         * Cancelled RMAs consume zero.
         * Closed RMAs consume received quantities only.
         * Open RMAs with receipts consume received quantities only.
         * Open RMAs without receipts consume their full quantities.
         */
        function getConsumedRMAQty(invoiceId, currentRmaId) {
            try {
                var consumed = {};
                var receiptQtyByRmaAndItem = {};
                var rmaHasAnyReceipt = {};

                var receiptFilters = [
                    ['createdfrom.createdfrom', 'anyof', invoiceId],
                    'AND',
                    ['mainline', 'is', 'F'],
                    'AND',
                    ['taxline', 'is', 'F'],
                    'AND',
                    ['shipping', 'is', 'F']
                ];

                if (currentRmaId) {
                    receiptFilters.push(
                        'AND',
                        ['createdfrom', 'noneof', currentRmaId]
                    );
                }

                log.debug({
                    title: 'Item Receipt Search',
                    details: {
                        sourceId: invoiceId,
                        currentRmaId: currentRmaId
                    }
                });

                search.create({
                    type: 'itemreceipt',
                    filters: receiptFilters,
                    columns: [
                        search.createColumn({
                            name: 'createdfrom',
                            summary: search.Summary.GROUP
                        }),
                        search.createColumn({
                            name: 'item',
                            summary: search.Summary.GROUP
                        }),
                        search.createColumn({
                            name: 'quantity',
                            summary: search.Summary.SUM
                        })
                    ]
                }).run().each(function (result) {
                    var rmaId = result.getValue({
                        name: 'createdfrom',
                        summary: search.Summary.GROUP
                    });

                    var itemId = result.getValue({
                        name: 'item',
                        summary: search.Summary.GROUP
                    });

                    var qty = Math.abs(
                        parseFloat(result.getValue({
                            name: 'quantity',
                            summary: search.Summary.SUM
                        })) || 0
                    );

                    var key = rmaId + '|' + itemId;

                    receiptQtyByRmaAndItem[key] =
                        (receiptQtyByRmaAndItem[key] || 0) + qty;

                    rmaHasAnyReceipt[rmaId] = true;

                    return true;
                });

                var rmaFilters = [
                    ['createdfrom', 'anyof', invoiceId],
                    'AND',
                    ['mainline', 'is', 'F'],
                    'AND',
                    ['taxline', 'is', 'F'],
                    'AND',
                    ['shipping', 'is', 'F']
                ];

                if (currentRmaId) {
                    rmaFilters.push(
                        'AND',
                        ['internalid', 'noneof', currentRmaId]
                    );
                }

                search.create({
                    type: 'returnauthorization',
                    filters: rmaFilters,
                    columns: [
                        search.createColumn({
                            name: 'internalid',
                            summary: search.Summary.GROUP
                        }),
                        search.createColumn({
                            name: 'status',
                            summary: search.Summary.GROUP
                        }),
                        search.createColumn({
                            name: 'item',
                            summary: search.Summary.GROUP
                        }),
                        search.createColumn({
                            name: 'quantity',
                            summary: search.Summary.SUM
                        })
                    ]
                }).run().each(function (result) {
                    var rmaId = result.getValue({
                        name: 'internalid',
                        summary: search.Summary.GROUP
                    });

                    var status = result.getValue({
                        name: 'status',
                        summary: search.Summary.GROUP
                    });

                    var itemId = result.getValue({
                        name: 'item',
                        summary: search.Summary.GROUP
                    });

                    var rmaQty = Math.abs(
                        parseFloat(result.getValue({
                            name: 'quantity',
                            summary: search.Summary.SUM
                        })) || 0
                    );

                    var receiptKey = rmaId + '|' + itemId;
                    var receivedQty = receiptQtyByRmaAndItem[receiptKey] || 0;
                    var qtyToConsume = 0;

                    if (status == 'RtnAuth:C') {
                        qtyToConsume = 0;
                    } else if (status == 'RtnAuth:H') {
                        qtyToConsume = receivedQty;
                    } else if (rmaHasAnyReceipt[rmaId]) {
                        qtyToConsume = receivedQty;
                    } else {
                        qtyToConsume = rmaQty;
                    }

                    consumed[itemId] =
                        (consumed[itemId] || 0) + qtyToConsume;

                    log.debug({
                        title: 'Consumed RMA Qty',
                        details: {
                            rmaId: rmaId,
                            status: status,
                            itemId: itemId,
                            rmaQty: rmaQty,
                            rmaHasAnyReceipt: !!rmaHasAnyReceipt[rmaId],
                            receivedQty: receivedQty,
                            qtyToConsume: qtyToConsume,
                            totalConsumedForItem: consumed[itemId]
                        }
                    });

                    return true;
                });

                log.debug({
                    title: 'Consumed RMA Qty Summary',
                    details: consumed
                });

                return consumed;

            } catch (e) {
                log.error({
                    title: 'getConsumedRMAQty Error',
                    details: e.message || String(e)
                });
                throw e;
            }
        }

        function deleteZeroItems() {
            try {
                var rec = currentRecord.get();
                var sourceId = rec.getValue({
                    fieldId: 'createdfrom'
                });

                if (!sourceId) {
                    dialog.alert({
                        title: 'Delete Zero Items',
                        message: 'This RMA is not created from another transaction, so there are no quantities to compare.'
                    });
                    return;
                }

                var lineCount = rec.getLineCount({
                    sublistId: SUBLIST
                });

                if (lineCount == 0) {
                    dialog.alert({
                        title: 'Delete Zero Items',
                        message: 'There are no item lines to process.'
                    });
                    return;
                }

                var consumed = getConsumedRMAQty(sourceId, rec.id);
                var linesToRemove = [];

                for (var i = 0; i < lineCount; i++) {
                    var itemId = rec.getSublistValue({
                        sublistId: SUBLIST,
                        fieldId: 'item',
                        line: i
                    });

                    var qty = Math.abs(
                        Number(rec.getSublistValue({
                            sublistId: SUBLIST,
                            fieldId: 'quantity',
                            line: i
                        })) || 0
                    );

                    var pool = consumed[itemId] || 0;

                    if (pool > 0 && qty <= pool) {
                        consumed[itemId] = pool - qty;
                        linesToRemove.push(i);

                        log.debug({
                            title: 'Delete Zero Items - Remove Line',
                            details: {
                                line: i + 1,
                                itemId: itemId,
                                quantity: qty,
                                remainingConsumedQty: consumed[itemId]
                            }
                        });
                    }
                }

                for (var d = linesToRemove.length - 1; d >= 0; d--) {
                    rec.removeLine({
                        sublistId: SUBLIST,
                        line: linesToRemove[d],
                        ignoreRecalc: true
                    });
                }

                log.debug({
                    title: 'Delete Zero Items - Completed',
                    details: {
                        removedLines: linesToRemove.length
                    }
                });

                dialog.alert({
                    title: 'Delete Zero Items',
                    message: 'Lines removed: ' + linesToRemove.length
                });

            } catch (e) {
                log.error({
                    title: 'deleteZeroItems Error',
                    details: e.message || String(e)
                });

                dialog.alert({
                    title: 'Delete Zero Items',
                    message: 'Error: ' + (e.message || String(e))
                });
            }
        }

        /**
         * Returns true if the item line has exactly one inventory
         * assignment. The selected line is cancelled afterwards.
         */
        function hasSingleInventoryDetailLine(rec, line) {
            try {
                rec.selectLine({
                    sublistId: SUBLIST,
                    line: line
                });

                var detail = rec.getCurrentSublistSubrecord({
                    sublistId: SUBLIST,
                    fieldId: INV_DETAIL_FIELD
                });

                return !!detail &&
                    detail.getLineCount({
                        sublistId: INV_ASSIGNMENT
                    }) == 1;

            } catch (e) {
                log.debug({
                    title: 'hasSingleInventoryDetailLine',
                    details: {
                        line: line + 1,
                        error: e.message || String(e)
                    }
                });

                return false;

            } finally {
                try {
                    rec.cancelLine({
                        sublistId: SUBLIST
                    });
                } catch (ignore) {
                    log.debug({
                        title: 'Cancel Line',
                        details: 'No selected line to cancel.'
                    });
                }
            }
        }

        function fillRemainingQuantity() {
            try {
                var rec = currentRecord.get();
                var sourceId = rec.getValue({
                    fieldId: 'createdfrom'
                });

                if (!sourceId) {
                    dialog.alert({
                        title: 'Fill Remaining Quantity',
                        message: 'This RMA is not created from another transaction, so there are no quantities to compare.'
                    });
                    return;
                }

                var lineCount = rec.getLineCount({
                    sublistId: SUBLIST
                });

                if (lineCount == 0) {
                    dialog.alert({
                        title: 'Fill Remaining Quantity',
                        message: 'There are no item lines to process.'
                    });
                    return;
                }

                var consumed = getConsumedRMAQty(sourceId, rec.id);
                var preview = [];
                var skipped = [];

                for (var i = 0; i < lineCount; i++) {
                    var itemId = rec.getSublistValue({
                        sublistId: SUBLIST,
                        fieldId: 'item',
                        line: i
                    });

                    var qty = Math.abs(
                        Number(rec.getSublistValue({
                            sublistId: SUBLIST,
                            fieldId: 'quantity',
                            line: i
                        })) || 0
                    );

                    var pool = consumed[itemId] || 0;

                    if (pool <= 0) {
                        continue;
                    }

                    if (qty <= pool) {
                        consumed[itemId] = pool - qty;
                        continue;
                    }

                    consumed[itemId] = 0;

                    if (hasSingleInventoryDetailLine(rec, i)) {
                        preview.push(
                            'Line ' + (i + 1) + ': ' +
                            qty + ' -> ' + (qty - pool)
                        );

                        log.debug({
                            title: 'Fill Remaining Quantity - Preview',
                            details: {
                                line: i + 1,
                                itemId: itemId,
                                originalQty: qty,
                                consumedQty: pool,
                                remainingQty: qty - pool
                            }
                        });
                    } else {
                        skipped.push('Line ' + (i + 1));
                    }
                }

                if (preview.length == 0) {
                    dialog.alert({
                        title: 'Fill Remaining Quantity',
                        message: 'No lines to update.' +
                            (skipped.length
                                ? '\nSkipped (not exactly one inventory detail line): ' +
                                  skipped.join(', ')
                                : '')
                    });
                    return;
                }

                rec.setValue({
                    fieldId: FLAG_FIELD,
                    value: true
                });

                log.debug({
                    title: 'Fill Remaining Quantity - Flag Set',
                    details: {
                        flagField: FLAG_FIELD,
                        previewLines: preview.length,
                        skippedLines: skipped.length
                    }
                });

                dialog.alert({
                    title: 'Fill Remaining Quantity',
                    message:
                        'These lines will be updated (line quantity and inventory detail) when you click Save:\n\n' +
                        preview.join('\n') +
                        (skipped.length
                            ? '\n\nSkipped (not exactly one inventory detail line): ' +
                              skipped.join(', ')
                            : '')
                });

            } catch (e) {
                log.error({
                    title: 'fillRemainingQuantity Error',
                    details: e.message || String(e)
                });

                dialog.alert({
                    title: 'Fill Remaining Quantity',
                    message: 'Error: ' + (e.message || String(e)) +
                        '\n\nMake sure the checkbox field ' + FLAG_FIELD +
                        ' exists on the Return Authorization form.'
                });
            }
        }

        return {
            pageInit: pageInit,
            deleteZeroItems: deleteZeroItems,
            fillRemainingQuantity: fillRemainingQuantity
        };
    }
);
