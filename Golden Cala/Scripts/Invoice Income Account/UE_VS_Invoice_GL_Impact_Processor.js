/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Invoice GL Impact Processor
 */
define(['N/record', 'N/log'], function (record, log) {

    function afterSubmit(context) {
        try {

            var newRecord = context.newRecord;
            var recordId = newRecord.id;

            log.debug('Script Started', {
                recordId: recordId
            });

            var completed = newRecord.getValue({
                fieldId: 'custrecord_vs_completed'
            });

            log.debug('Completed Status', completed);

            if (completed == true || completed == 'T') {
                log.debug('Process Stopped', 'Record already completed');
                return;
            }

            var invoiceId = newRecord.getValue({ fieldId: 'custrecord_vs_invoice_id' });
            var customGLAccount = newRecord.getValue({ fieldId: 'custrecord_vs_custom_gl_account' });

            log.debug('Header Values', {
                invoiceId: invoiceId,
                customGLAccount: customGLAccount
            });

            if (!invoiceId || !customGLAccount) {
                log.error('Missing Required Values', 'Invoice ID or Custom GL Account is missing');
                return;
            }

            var invoiceRecord = record.load({
                type: record.Type.INVOICE,
                id: invoiceId,
                isDynamic: false
            });

            log.debug('Invoice Record Loaded', {
                invoiceId: invoiceId
            });

            var lineCount = newRecord.getLineCount({ sublistId: 'recmachcustrecord_vs_parent' });
            var totalJvAmount = 0;
            var jvLinesToUpdate = [];

            log.debug('Line Count', lineCount);

            for (var i = 0; i < lineCount; i++) {

                try {

                    var itemId = newRecord.getSublistValue({ sublistId: 'recmachcustrecord_vs_parent', fieldId: 'custrecord_vs_item', line: i });
                    var originalRate = parseFloat(newRecord.getSublistValue({ sublistId: 'recmachcustrecord_vs_parent', fieldId: 'custrecord_vs_original_rate', line: i })) || 0;
                    var jvQty = parseFloat(newRecord.getSublistValue({ sublistId: 'recmachcustrecord_vs_parent', fieldId: 'custrecord_vs_jv_quantity', line: i })) || 0;
                    var creditQty = parseFloat(newRecord.getSublistValue({ sublistId: 'recmachcustrecord_vs_parent', fieldId: 'custrecord_vs_credit_quantity', line: i })) || 0;
                    var lineInternalId = newRecord.getSublistValue({ sublistId: 'recmachcustrecord_vs_parent', fieldId: 'id', line: i });

                    log.debug('Processing Line', {
                        line: i,
                        itemId: itemId,
                        originalRate: originalRate,
                        jvQty: jvQty,
                        creditQty: creditQty,
                        lineInternalId: lineInternalId
                    });

                    /*
                        JOURNAL ENTRY
                    */
                    if (jvQty > 0) {

                        var jvAmount = parseFloat(jvQty * originalRate);

                        totalJvAmount += jvAmount;

                        log.debug('JV Amount Added To Total', {
                            line: i,
                            itemId: itemId,
                            jvQty: jvQty,
                            originalRate: originalRate,
                            jvAmount: jvAmount,
                            totalJvAmount: totalJvAmount
                        });

                        var currentJvDeducted = parseFloat(
                            newRecord.getSublistValue({
                                sublistId: 'recmachcustrecord_vs_parent',
                                fieldId: 'custrecord_vs_jv_qty_deducted',
                                line: i
                            })
                        ) || 0;

                        jvLinesToUpdate.push({
                            lineInternalId: lineInternalId,
                            currentJvDeducted: currentJvDeducted,
                            jvQty: jvQty
                        });

                        log.debug('JV Line Queued For Update', {
                            lineInternalId: lineInternalId,
                            currentJvDeducted: currentJvDeducted,
                            jvQty: jvQty
                        });
                    }

                    /*
                        CREDIT MEMO
                    */
                    var hasCreditLines = false;

                    for (var checkLine = 0; checkLine < lineCount; checkLine++) {

                        var checkCreditQty = parseFloat(
                            newRecord.getSublistValue({
                                sublistId: 'recmachcustrecord_vs_parent',
                                fieldId: 'custrecord_vs_credit_quantity',
                                line: checkLine
                            })
                        ) || 0;

                        if (checkCreditQty > 0) {
                            hasCreditLines = true;
                            break;
                        }
                    }

                    if (hasCreditLines == true && i == 0) {

                        log.debug('Creating Credit Memo', 'Processing all credit lines');

                        var creditMemo = record.transform({
                            fromType: record.Type.INVOICE,
                            fromId: invoiceId,
                            toType: record.Type.CREDIT_MEMO,
                            isDynamic: true
                        });

                        creditMemo.setValue({
                            fieldId: 'custbody_vs_gl_impact_record',
                            value: recordId
                        });

                        try {

                            var applyLineCount = creditMemo.getLineCount({
                                sublistId: 'apply'
                            });

                            log.debug('Apply Line Count', applyLineCount);

                            for (var applyLine = 0; applyLine < applyLineCount; applyLine++) {

                                creditMemo.selectLine({
                                    sublistId: 'apply',
                                    line: applyLine
                                });

                                creditMemo.setCurrentSublistValue({
                                    sublistId: 'apply',
                                    fieldId: 'apply',
                                    value: false
                                });

                                creditMemo.commitLine({
                                    sublistId: 'apply'
                                });
                            }

                            log.debug('Apply Lines Cleared', applyLineCount);

                        } catch (applyErr) {

                            log.error('Apply Sublist Error', applyErr);
                        }

                        var cmLineCount = creditMemo.getLineCount({
                            sublistId: 'item'
                        });

                        log.debug('Credit Memo Line Count', cmLineCount);

                        for (var x = cmLineCount - 1; x >= 0; x--) {

                            try {

                                var cmItem = creditMemo.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'item',
                                    line: x
                                });

                                log.debug('Processing Credit Memo Line', {
                                    line: x,
                                    cmItem: cmItem
                                });

                                var matchedCreditQty = 0;
                                var invoiceLineNumber = -1;
                                var customLineInternalId = '';

                                for (var customLine = 0; customLine < lineCount; customLine++) {

                                    var customItem = newRecord.getSublistValue({
                                        sublistId: 'recmachcustrecord_vs_parent',
                                        fieldId: 'custrecord_vs_item',
                                        line: customLine
                                    });

                                    var customCreditQty = parseFloat(
                                        newRecord.getSublistValue({
                                            sublistId: 'recmachcustrecord_vs_parent',
                                            fieldId: 'custrecord_vs_credit_quantity',
                                            line: customLine
                                        })
                                    ) || 0;

                                    if (customItem == cmItem) {

                                        matchedCreditQty = customCreditQty;

                                        customLineInternalId = newRecord.getSublistValue({
                                            sublistId: 'recmachcustrecord_vs_parent',
                                            fieldId: 'id',
                                            line: customLine
                                        });

                                        for (var invLineSearch = 0; invLineSearch < invoiceRecord.getLineCount({ sublistId: 'item' }); invLineSearch++) {

                                            var invoiceSearchItem = invoiceRecord.getSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'item',
                                                line: invLineSearch
                                            });

                                            if (invoiceSearchItem == cmItem) {

                                                invoiceLineNumber = invLineSearch;

                                                break;
                                            }
                                        }

                                        break;
                                    }
                                }

                                log.debug('Matched Credit Qty', {
                                    cmItem: cmItem,
                                    matchedCreditQty: matchedCreditQty,
                                    invoiceLineNumber: invoiceLineNumber
                                });

                                if (matchedCreditQty <= 0) {

                                    log.debug('Removing Credit Memo Line', {
                                        line: x,
                                        cmItem: cmItem
                                    });

                                    creditMemo.removeLine({
                                        sublistId: 'item',
                                        line: x
                                    });

                                    continue;
                                }

                                creditMemo.selectLine({
                                    sublistId: 'item',
                                    line: x
                                });

                                creditMemo.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'quantity',
                                    value: matchedCreditQty
                                });

                                try {

                                    var invoiceInventoryDetail = invoiceRecord.getSublistSubrecord({
                                        sublistId: 'item',
                                        fieldId: 'inventorydetail',
                                        line: invoiceLineNumber
                                    });

                                    if (invoiceInventoryDetail) {

                                        var inventoryAssignmentCount = invoiceInventoryDetail.getLineCount({
                                            sublistId: 'inventoryassignment'
                                        });

                                        log.debug('Inventory Assignment Count', inventoryAssignmentCount);

                                        var creditMemoInventoryDetail = creditMemo.getCurrentSublistSubrecord({
                                            sublistId: 'item',
                                            fieldId: 'inventorydetail'
                                        });

                                        while (creditMemoInventoryDetail.getLineCount({
                                            sublistId: 'inventoryassignment'
                                        }) > 0) {

                                            creditMemoInventoryDetail.removeLine({
                                                sublistId: 'inventoryassignment',
                                                line: 0
                                            });
                                        }

                                        var remainingCreditQty = matchedCreditQty;

                                        for (var invAssignLine = 0; invAssignLine < inventoryAssignmentCount; invAssignLine++) {

                                            if (remainingCreditQty <= 0) {
                                                break;
                                            }

                                            var lotNumber = invoiceInventoryDetail.getSublistValue({
                                                sublistId: 'inventoryassignment',
                                                fieldId: 'issueinventorynumber',
                                                line: invAssignLine
                                            });

                                            var assignmentQty = parseFloat(
                                                invoiceInventoryDetail.getSublistValue({
                                                    sublistId: 'inventoryassignment',
                                                    fieldId: 'quantity',
                                                    line: invAssignLine
                                                })
                                            ) || 0;

                                            var qtyToApply = assignmentQty;

                                            if (qtyToApply > remainingCreditQty) {
                                                qtyToApply = remainingCreditQty;
                                            }

                                            log.debug('Applying Inventory Assignment', {
                                                lotNumber: lotNumber,
                                                assignmentQty: assignmentQty,
                                                qtyToApply: qtyToApply
                                            });

                                            creditMemoInventoryDetail.selectNewLine({
                                                sublistId: 'inventoryassignment'
                                            });

                                            creditMemoInventoryDetail.setCurrentSublistValue({
                                                sublistId: 'inventoryassignment',
                                                fieldId: 'receiptinventorynumber',
                                                value: lotNumber
                                            });

                                            creditMemoInventoryDetail.setCurrentSublistValue({
                                                sublistId: 'inventoryassignment',
                                                fieldId: 'quantity',
                                                value: qtyToApply
                                            });

                                            creditMemoInventoryDetail.commitLine({
                                                sublistId: 'inventoryassignment'
                                            });

                                            remainingCreditQty = remainingCreditQty - qtyToApply;
                                        }
                                    }

                                } catch (inventoryErr) {

                                    log.error('Inventory Detail Error', inventoryErr);
                                }

                                creditMemo.commitLine({
                                    sublistId: 'item'
                                });

                            } catch (cmLineErr) {

                                log.error('Credit Memo Line Error', {
                                    line: x,
                                    error: cmLineErr
                                });
                            }
                        }

                        var creditMemoId = creditMemo.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });

                        log.debug('Credit Memo Created', creditMemoId);

                        try {

                            var cmApplyRec = record.load({
                                type: record.Type.CREDIT_MEMO,
                                id: creditMemoId,
                                isDynamic: true
                            });

                            var createdFromText = cmApplyRec.getText({
                                fieldId: 'createdfrom'
                            });

                            log.debug('Created From Text', createdFromText);

                            if (createdFromText) {

                                var invoiceNumber = createdFromText
                                    .replace('Invoice #', '')
                                    .trim();

                                log.debug('Invoice Number', invoiceNumber);

                                var applyLineCount = cmApplyRec.getLineCount({
                                    sublistId: 'apply'
                                });

                                log.debug('Apply Line Count', applyLineCount);

                                for (var applyLine = 0; applyLine < applyLineCount; applyLine++) {

                                    var refNum = cmApplyRec.getSublistValue({
                                        sublistId: 'apply',
                                        fieldId: 'refnum',
                                        line: applyLine
                                    });

                                    log.debug('Checking Apply Line', {
                                        line: applyLine,
                                        refNum: refNum,
                                        invoiceNumber: invoiceNumber
                                    });

                                    if (refNum == invoiceNumber) {

                                        cmApplyRec.selectLine({
                                            sublistId: 'apply',
                                            line: applyLine
                                        });

                                        cmApplyRec.setCurrentSublistValue({
                                            sublistId: 'apply',
                                            fieldId: 'apply',
                                            value: true
                                        });

                                        cmApplyRec.commitLine({
                                            sublistId: 'apply'
                                        });

                                        log.debug('Invoice Applied', invoiceNumber);

                                        break;
                                    }
                                }

                                var updatedCreditMemoId = cmApplyRec.save({
                                    enableSourcing: true,
                                    ignoreMandatoryFields: true
                                });

                                log.debug('Credit Memo Updated With Apply', updatedCreditMemoId);
                            }

                        } catch (applyInvoiceErr) {

                            log.error('Apply Invoice Error', applyInvoiceErr);
                        }

                        if (creditMemoId) {

                            for (var updateLine = 0; updateLine < lineCount; updateLine++) {

                                var updateCreditQty = parseFloat(
                                    newRecord.getSublistValue({
                                        sublistId: 'recmachcustrecord_vs_parent',
                                        fieldId: 'custrecord_vs_credit_quantity',
                                        line: updateLine
                                    })
                                ) || 0;

                                if (updateCreditQty > 0) {

                                    var updateLineInternalId = newRecord.getSublistValue({
                                        sublistId: 'recmachcustrecord_vs_parent',
                                        fieldId: 'id',
                                        line: updateLine
                                    });

                                    var currentCreditDeducted = parseFloat(
                                        newRecord.getSublistValue({
                                            sublistId: 'recmachcustrecord_vs_parent',
                                            fieldId: 'custrecord_vs_credit_qty_deducted',
                                            line: updateLine
                                        })
                                    ) || 0;

                                    var totalCreditDeducted = parseFloat(
                                        currentCreditDeducted + updateCreditQty
                                    );

                                    record.submitFields({
                                        type: 'customrecord_vs_invoice_gl_impact_lines',
                                        id: updateLineInternalId,
                                        values: {
                                            custrecord_vs_credit_qty_deducted: totalCreditDeducted,
                                            custrecord_vs_credit_quantity: 0
                                        }
                                    });

                                    log.debug('Credit Quantity Updated', {
                                        line: updateLine,
                                        totalCreditDeducted: totalCreditDeducted
                                    });
                                }
                            }
                        }
                    }

                } catch (lineErr) {

                    log.error('Line Processing Error', {
                        line: i,
                        error: lineErr
                    });
                }
            }

            if (totalJvAmount > 0) {

                log.debug('Creating Consolidated Journal Entry', {
                    totalJvAmount: totalJvAmount
                });

                var journalEntry = record.create({
                    type: record.Type.JOURNAL_ENTRY,
                    isDynamic: true
                });

                journalEntry.setValue({
                    fieldId: 'subsidiary',
                    value: 2
                });

                journalEntry.setValue({
                    fieldId: 'custbody_vs_gl_impact_record',
                    value: recordId
                });

                journalEntry.selectNewLine({
                    sublistId: 'line'
                });

                journalEntry.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'account',
                    value: customGLAccount
                });

                journalEntry.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'debit',
                    value: totalJvAmount
                });

                journalEntry.commitLine({
                    sublistId: 'line'
                });

                journalEntry.selectNewLine({
                    sublistId: 'line'
                });

                journalEntry.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'account',
                    value: 337
                });

                journalEntry.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'credit',
                    value: totalJvAmount
                });

                journalEntry.commitLine({
                    sublistId: 'line'
                });

                var journalId = journalEntry.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                log.debug('Consolidated Journal Entry Created', {
                    journalId: journalId,
                    totalJvAmount: totalJvAmount
                });

                if (journalId) {

                    for (var j = 0; j < jvLinesToUpdate.length; j++) {

                        var lineObj = jvLinesToUpdate[j];

                        var totalJvDeducted = parseFloat(
                            lineObj.currentJvDeducted + lineObj.jvQty
                        );

                        record.submitFields({
                            type: 'customrecord_vs_invoice_gl_impact_lines',
                            id: lineObj.lineInternalId,
                            values: {
                                custrecord_vs_jv_qty_deducted: totalJvDeducted,
                                custrecord_vs_jv_quantity: 0
                            }
                        });

                        log.debug('JV Quantity Updated To Zero', {
                            lineInternalId: lineObj.lineInternalId,
                            totalJvDeducted: totalJvDeducted
                        });
                    }
                }
            }

            var allLinesCompleted = true;

            var refreshedRecord = record.load({
                type: 'customrecord_vs_invoice_gl_impact',
                id: recordId,
                isDynamic: false
            });

            for (var z = 0; z < lineCount; z++) {

                try {

                    var remainingQty = parseFloat(
                        refreshedRecord.getSublistValue({
                            sublistId: 'recmachcustrecord_vs_parent',
                            fieldId: 'custrecord_vs_remaining_quantity',
                            line: z
                        })
                    ) || 0;

                    log.debug('Remaining Quantity Check', {
                        line: z,
                        remainingQty: remainingQty
                    });

                    if (remainingQty > 0) {

                        allLinesCompleted = false;

                        log.debug('Line Still Pending', {
                            line: z,
                            remainingQty: remainingQty
                        });

                        break;
                    }

                } catch (remainingErr) {

                    log.error('Remaining Quantity Check Error', {
                        line: z,
                        error: remainingErr
                    });

                    allLinesCompleted = false;
                    break;
                }
            }

            log.debug('All Lines Completed Status', allLinesCompleted);

            if (allLinesCompleted == true) {

                record.submitFields({
                    type: 'customrecord_vs_invoice_gl_impact',
                    id: recordId,
                    values: {
                        custrecord_vs_completed: true
                    }
                });

                log.debug('Parent Record Marked Completed', recordId);
            }

        } catch (e) {

            log.error('afterSubmit Error', e);
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});