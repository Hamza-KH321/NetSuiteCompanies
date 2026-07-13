/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * @fileName SL_ICSO_Automate_Receiving.js
 *
 * Triggered by the "Automate Intercompany SO Receiving" button on the Sales
 * Order form. Runs the same logic as the original UE || ICSO Auto IF and
 * Invoice script (afterSubmit), but on-demand for a single SO.
 */

define(['N/record', 'N/search', 'N/log', 'N/task', 'N/url', 'N/redirect'],
    function (record, search, log, task, url, redirect) {

        var CONFIG = {
            entity: 520118, // V-575 Intercompany - VitaCare
            subsidiary: 5,       // Smart Basket
            mrScriptId: 'customscript_vs_mr_icpo_ir_from_if',
            mrDeploymentId: 'customdeploy_vs_mr_icpo_ir_from_if'
        };

        var FIELDS = {
            soIntercoTransaction: 'intercotransaction',
            icpoIR: 'custbody_vs_intercompany_ir',
            fulfilmentCreated: 'custbody_vs_ic_fulfilment_created'
        };

        function onRequest(context) {

            log.debug({ title: 'IC SO Suitelet | Request received', details: 'method: ' + context.request.method + ' | params: ' + JSON.stringify(context.request.parameters) });

            if (context.request.method !== 'GET') {
                writePage(context, { error: 'Invalid request method.' });
                return;
            }

            var soId = context.request.parameters.soid;

            if (!soId) {
                writePage(context, { error: 'No sales order id supplied.' });
                return;
            }

            try {

                var soRecord = record.load({
                    type: record.Type.SALES_ORDER,
                    id: soId,
                    isDynamic: false
                });

                var entity = soRecord.getValue({ fieldId: 'entity' });
                var subsidiary = soRecord.getValue({ fieldId: 'subsidiary' });
                var intercoTxn = soRecord.getValue({ fieldId: FIELDS.soIntercoTransaction });
                var alreadyFlagged = soRecord.getValue({ fieldId: FIELDS.fulfilmentCreated });

                if (entity != CONFIG.entity || subsidiary != CONFIG.subsidiary || !intercoTxn) {
                    writePage(context, { error: 'Conditions not met for this sales order.', soId: soId });
                    return;
                }

                if (alreadyFlagged) {
                    writePage(context, { error: 'This sales order has already been processed.', soId: soId });
                    return;
                }

                if (fulfillmentAlreadyExists(soId)) {
                    writePage(context, { error: 'A fulfillment already exists for this sales order.', soId: soId });
                    return;
                }

                // ICPO -> linked Item Receipt
                var irId = record.load({
                    type: record.Type.PURCHASE_ORDER,
                    id: intercoTxn,
                    isDynamic: false
                }).getValue({ fieldId: FIELDS.icpoIR });

                if (!irId) {
                    log.error({ title: 'IC SO | No IR Found', details: 'ICPO ' + intercoTxn + ' has no linked IR. SO: ' + soId });
                    writePage(context, { error: 'No linked Item Receipt found on the intercompany PO.', soId: soId });
                    return;
                }

                var invDetailsByItem = getInventoryDetailsFromIR(irId);

                var fulfillmentId = createItemFulfillment(soId, invDetailsByItem);
                log.audit({ title: 'IC SO | Fulfillment Created', details: 'IF: ' + fulfillmentId + ' | SO: ' + soId });

                flagFulfillmentCreated(soId);

                triggerIntercoItemReceiptMR(fulfillmentId, intercoTxn, soId);

                writePage(context, { success: true, soId: soId, fulfillmentId: fulfillmentId });

            } catch (e) {
                log.error({ title: 'IC SO | Suitelet Error', details: 'SO ' + soId + ' | ' + e.name + ': ' + e.message + ' | stack: ' + (e.stack || 'n/a') });
                writePage(context, { error: e.message, soId: soId });
            }
        }

        function writePage(context, result) {
            var backUrl = result.soId
                ? url.resolveRecord({ recordType: record.Type.SALES_ORDER, recordId: result.soId, isEditMode: false })
                : null;

            var body;

            if (result.success) {
                body = '<h2>Done</h2>' +
                    '<p>Item Fulfillment <b>' + result.fulfillmentId + '</b> was created, and the Item Receipt ' +
                    'has been queued for processing.</p>';
            } else {
                body = '<h2>Could not process this sales order</h2>' +
                    '<p>' + escapeHtml(result.error) + '</p>';
            }

            if (backUrl) {
                body += '<p><a href="' + backUrl + '">Back to Sales Order</a></p>';
            }

            context.response.write(
                '<html><body style="font-family: sans-serif; padding: 20px;">' + body + '</body></html>'
            );
        }

        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        // checks if an item fulfillment already exists for this SO
        function fulfillmentAlreadyExists(soId) {
            var exists = false;

            var ifSearch = search.create({
                type: search.Type.ITEM_FULFILLMENT,
                filters: [
                    ['createdfrom', 'anyof', soId],
                    'AND',
                    ['mainline', 'is', 'T']
                ],
                columns: ['internalid']
            });

            ifSearch.run().each(function () {
                exists = true;
                return false;
            });

            return exists;
        }

        // flags the sales order once fulfillment has been created
        function flagFulfillmentCreated(soId) {
            try {
                var values = {};
                values[FIELDS.fulfilmentCreated] = true;

                record.submitFields({
                    type: record.Type.SALES_ORDER,
                    id: soId,
                    values: values,
                    options: { enableSourcing: false, ignoreMandatoryFields: true }
                });
            } catch (flagErr) {
                log.error({ title: 'IC SO | SO Flag Error', details: 'SO ' + soId + ' | ' + flagErr.name + ': ' + flagErr.message });
            }
        }

        // itemId -> array of IR lines, each with its inventory assignments
        function getInventoryDetailsFromIR(irId) {
            var irRecord = record.load({
                type: record.Type.ITEM_RECEIPT,
                id: irId,
                isDynamic: false
            });

            var detailsByItem = {};
            var itemIds = [];
            var lotNums = [];
            var lineCount = irRecord.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < lineCount; i++) {
                var itemId = irRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                var assignments = [];

                var subrecord = irRecord.getSublistSubrecord({
                    sublistId: 'item', fieldId: 'inventorydetail', line: i
                });

                if (subrecord) {
                    var assignCount = subrecord.getLineCount({ sublistId: 'inventoryassignment' });
                    for (var j = 0; j < assignCount; j++) {
                        var lotNumber = subrecord.getSublistValue({
                            sublistId: 'inventoryassignment', fieldId: 'receiptinventorynumber', line: j
                        });

                        assignments.push({
                            lotNumber: lotNumber, // text, e.g. "Test Lot 1" - resolved to an internal id below
                            quantity: subrecord.getSublistValue({
                                sublistId: 'inventoryassignment', fieldId: 'quantity', line: j
                            }),
                            binnumber: subrecord.getSublistValue({
                                sublistId: 'inventoryassignment', fieldId: 'binnumber', line: j
                            })
                        });

                        if (lotNumber) {
                            if (itemIds.indexOf(itemId) === -1) itemIds.push(itemId);
                            if (lotNums.indexOf(lotNumber) === -1) lotNums.push(lotNumber);
                        }
                    }
                }

                if (!detailsByItem[itemId]) {
                    detailsByItem[itemId] = [];
                }
                detailsByItem[itemId].push({ assignments: assignments });
            }

            // one search resolves lot number text -> internal id for every item/lot at once
            var lotIdMap = getLotInternalIds(itemIds, lotNums);

            Object.keys(detailsByItem).forEach(function (itemId) {
                detailsByItem[itemId].forEach(function (line) {
                    line.assignments.forEach(function (a) {
                        if (a.lotNumber) {
                            a.lotInternalId = lotIdMap[itemId + '|' + a.lotNumber] || null;
                        }
                    });
                });
            });

            return detailsByItem;
        }

        // bulk-resolve inventory number (lot/serial) internal ids for a set of items/lots
        function getLotInternalIds(itemIds, lotNums) {
            var map = {};
            if (!itemIds.length || !lotNums.length) return map;

            // 'inventorynumber' is a free-form text field, not a list field, so it can't use 'anyof' -
            // filter by item (a real list field) and match the lot text in JS instead
            var lotSearch = search.create({
                type: 'inventorynumber',
                filters: [
                    ['item', 'anyof', itemIds]
                ],
                columns: ['internalid', 'item', 'inventorynumber']
            });

            lotSearch.run().each(function (result) {
                var itemId = result.getValue({ name: 'item' });
                var lotNumber = result.getValue({ name: 'inventorynumber' });

                if (lotNums.indexOf(lotNumber) !== -1) {
                    map[itemId + '|' + lotNumber] = result.getValue({ name: 'internalid' });
                }
                return true;
            });

            return map;
        }

        function createItemFulfillment(soId, invDetailsByItem) {
            var fulfillment = record.transform({
                fromType: record.Type.SALES_ORDER,
                fromId: soId,
                toType: record.Type.ITEM_FULFILLMENT,
                isDynamic: true
            });

            var consumedIndex = {}; // per-item pointer into invDetailsByItem

            var lineCount = fulfillment.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < lineCount; i++) {
                fulfillment.selectLine({ sublistId: 'item', line: i });

                var itemId = fulfillment.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' });
                fulfillment.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: true });

                var itemSource = invDetailsByItem[itemId];

                if (itemSource && itemSource.length) {
                    var idx = consumedIndex[itemId] || 0;
                    var sourceLine = itemSource[idx];

                    if (sourceLine && sourceLine.assignments.length) {
                        var invSub = fulfillment.getCurrentSublistSubrecord({
                            sublistId: 'item', fieldId: 'inventorydetail'
                        });

                        if (invSub) {
                            sourceLine.assignments.forEach(function (a, aIdx) {
                                if (a.lotNumber && !a.lotInternalId) {
                                    log.error({ title: 'IC SO | Lot Not Resolved', details: 'Lot "' + a.lotNumber + '" (item ' + itemId + ') has no matching inventorynumber record' });
                                    return; // skip this assignment rather than fail with an invalid text value
                                }

                                try {
                                    invSub.selectNewLine({ sublistId: 'inventoryassignment' });

                                    if (a.lotInternalId) {
                                        invSub.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'issueinventorynumber',
                                            value: a.lotInternalId
                                        });
                                    }
                                    invSub.setCurrentSublistValue({
                                        sublistId: 'inventoryassignment', fieldId: 'quantity', value: parseFloat(a.quantity) || 0
                                    });
                                    if (a.binnumber) {
                                        invSub.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment', fieldId: 'binnumber', value: a.binnumber
                                        });
                                    }

                                    invSub.commitLine({ sublistId: 'inventoryassignment' });
                                } catch (invErr) {
                                    log.error({
                                        title: 'IC SO | Inventory Assignment Error',
                                        details: 'item ' + itemId + ' | fulfillment line ' + i + ' | assignment ' + aIdx +
                                            ' | lotInternalId ' + a.lotInternalId + ' | qty ' + a.quantity + ' | bin ' + a.binnumber +
                                            ' | ' + invErr.name + ': ' + invErr.message
                                    });
                                    throw invErr;
                                }
                            });
                        }
                    }

                    consumedIndex[itemId] = idx + 1;
                }

                fulfillment.commitLine({ sublistId: 'item' });
            }

            fulfillment.setValue({ fieldId: 'shipstatus', value: 'C' });
            fulfillment.setValue({ fieldId: FIELDS.fulfilmentCreated, value: true });

            try {
                return fulfillment.save({ enableSourcing: false, ignoreMandatoryFields: true });
            } catch (saveErr) {
                log.error({ title: 'IC SO | Fulfillment Save Error', details: 'SO ' + soId + ' | ' + saveErr.name + ': ' + saveErr.message + ' | stack: ' + (saveErr.stack || 'n/a') });
                throw saveErr;
            }
        }

        // function createInvoiceFromSalesOrder(soId) {
        //     var invoice = record.transform({
        //         fromType:  record.Type.SALES_ORDER,
        //         fromId:    soId,
        //         toType:    record.Type.INVOICE,
        //         isDynamic: true
        //     });

        //     try {
        //         return invoice.save({ enableSourcing: false, ignoreMandatoryFields: true });
        //     } catch (saveErr) {
        //         log.error({ title: 'IC SO | Invoice Save Error', details: 'SO ' + soId + ' | ' + saveErr.name + ': ' + saveErr.message + ' | stack: ' + (saveErr.stack || 'n/a') });
        //         throw saveErr;
        //     }
        // }

        function triggerIntercoItemReceiptMR(fulfillmentId, poId, soId) {
            try {
                var mrTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: CONFIG.mrScriptId,
                    deploymentId: CONFIG.mrDeploymentId,
                    params: {
                        custscript_vs_ic_ir_if_id: fulfillmentId,
                        custscript_vs_ic_ir_po_id: poId
                    }
                });
                var mrTaskId = mrTask.submit();
                log.audit({ title: 'IC SO | MR Task Submitted', details: 'Task ID: ' + mrTaskId + ' | IF: ' + fulfillmentId + ' | PO: ' + poId });
            } catch (taskErr) {
                // don't let a task-submit failure roll back the SO/IF that already succeeded
                log.error({ title: 'IC SO | MR Task Submit Error', details: 'IF ' + fulfillmentId + ' | PO ' + poId + ' | ' + taskErr.name + ': ' + taskErr.message });
            }
        }

        return { onRequest: onRequest };
    });