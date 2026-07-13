/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || ICPO IR From IF
 */

define(['N/record', 'N/search', 'N/log', 'N/runtime'], function (record, search, log, runtime) {

    function getInputData() {
        var script = runtime.getCurrentScript();
        var fulfillmentId = script.getParameter({ name: 'custscript_vs_ic_ir_if_id' });
        var poId = script.getParameter({ name: 'custscript_vs_ic_ir_po_id' });

        if (!fulfillmentId || !poId) {
            log.error({ title: 'IC PO IR | Missing Params', details: 'IF: ' + fulfillmentId + ' | PO: ' + poId });
            return [];
        }

        if (itemReceiptAlreadyExists(poId)) {
            log.audit({ title: 'IC PO IR | Skipped', details: 'Item Receipt already exists for PO ' + poId });
            return [];
        }

        return [{ fulfillmentId: fulfillmentId, poId: poId }];
    }

    function itemReceiptAlreadyExists(poId) {
        var exists = false;
        var irSearch = search.create({
            type: search.Type.ITEM_RECEIPT,
            filters: [
                ['createdfrom', 'anyof', poId],
                'AND',
                ['mainline', 'is', 'T']
            ],
            columns: ['internalid']
        });
        irSearch.run().each(function () {
            exists = true;
            return false;
        });
        return exists;
    }

    function map(context) {
        var data = JSON.parse(context.value);
        var fulfillmentId = data.fulfillmentId;
        var poId = data.poId;

        try {
            var invDetailsByItem = getInventoryDetailsFromFulfillment(fulfillmentId);
            var receiptId = createItemReceipt(poId, invDetailsByItem);
            log.audit({ title: 'IC PO IR | Receipt Created', details: 'IR: ' + receiptId + ' | PO: ' + poId + ' | IF: ' + fulfillmentId });
        } catch (e) {
            log.error({ title: 'IC PO IR | Map Error', details: 'PO ' + poId + ' | IF ' + fulfillmentId + ' | ' + e.name + ': ' + e.message + ' | stack: ' + (e.stack || 'n/a') });
        }
    }

    // mirror of the IR-side reader in the UE script, but reads issued lots off the Item Fulfillment
    function getInventoryDetailsFromFulfillment(fulfillmentId) {
        var ifRecord = record.load({ type: record.Type.ITEM_FULFILLMENT, id: fulfillmentId, isDynamic: false });

        var detailsByItem = {};
        var lineCount = ifRecord.getLineCount({ sublistId: 'item' });

        for (var i = 0; i < lineCount; i++) {
            var itemId = ifRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
            var assignments = [];

            var subrecord = ifRecord.getSublistSubrecord({
                sublistId: 'item', fieldId: 'inventorydetail', line: i
            });

            if (subrecord) {
                var assignCount = subrecord.getLineCount({ sublistId: 'inventoryassignment' });
                for (var j = 0; j < assignCount; j++) {
                    // issueinventorynumber is a select field - getValue returns the selling
                    // subsidiary's internal id, which is meaningless on the receiving side.
                    // getText gives the lot's actual name/serial, which is what the intercompany
                    // transfer validation matches against.
                    var lotNumberText = subrecord.getSublistText({
                        sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', line: j
                    });

                    assignments.push({
                        lotNumberText: lotNumberText || null,
                        quantity: subrecord.getSublistValue({
                            sublistId: 'inventoryassignment', fieldId: 'quantity', line: j
                        }),
                        binnumber: subrecord.getSublistValue({
                            sublistId: 'inventoryassignment', fieldId: 'binnumber', line: j
                        })
                    });
                }
            }

            if (!detailsByItem[itemId]) detailsByItem[itemId] = [];
            detailsByItem[itemId].push({ assignments: assignments });
        }

        return detailsByItem;
    }

    function getLotInternalIds(itemIds, lotNums) {
        var map = {};
        if (!itemIds.length || !lotNums.length) return map;

        var lotSearch = search.create({
            type: 'inventorynumber',
            filters: [['item', 'anyof', itemIds]],
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

    function createItemReceipt(poId, invDetailsByItem) {
        var receipt = record.transform({
            fromType: record.Type.PURCHASE_ORDER,
            fromId: poId,
            toType: record.Type.ITEM_RECEIPT,
            isDynamic: true
        });

        var consumedIndex = {};
        var lineCount = receipt.getLineCount({ sublistId: 'item' });

        for (var i = 0; i < lineCount; i++) {
            receipt.selectLine({ sublistId: 'item', line: i });

            var itemId = receipt.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' });
            receipt.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: true });

            var itemSource = invDetailsByItem[itemId];

            if (itemSource && itemSource.length) {
                var idx = consumedIndex[itemId] || 0;
                var sourceLine = itemSource[idx];

                if (sourceLine && sourceLine.assignments.length) {
                    var invSub = receipt.getCurrentSublistSubrecord({
                        sublistId: 'item', fieldId: 'inventorydetail'
                    });

                    if (invSub) {
                        sourceLine.assignments.forEach(function (a, aIdx) {
                            if (!a.lotNumberText) {
                                log.error({ title: 'IC PO IR | Lot Text Missing', details: 'item ' + itemId + ' | no lot text on IF line' });
                                return;
                            }

                            try {
                                invSub.selectNewLine({ sublistId: 'inventoryassignment' });

                                invSub.setCurrentSublistValue({
                                    sublistId: 'inventoryassignment', fieldId: 'receiptinventorynumber', value: a.lotNumberText
                                });
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
                                    title: 'IC PO IR | Inventory Assignment Error',
                                    details: 'item ' + itemId + ' | receipt line ' + i + ' | assignment ' + aIdx +
                                        ' | lotNumberText ' + a.lotNumberText + ' | qty ' + a.quantity + ' | bin ' + a.binnumber +
                                        ' | ' + invErr.name + ': ' + invErr.message
                                });
                                throw invErr;
                            }
                        });
                    }
                }

                consumedIndex[itemId] = idx + 1;
            }

            receipt.commitLine({ sublistId: 'item' });
        }

        try {
            return receipt.save({ enableSourcing: false, ignoreMandatoryFields: true });
        } catch (saveErr) {
            log.error({ title: 'IC PO IR | Save Error', details: 'PO ' + poId + ' | ' + saveErr.name + ': ' + saveErr.message + ' | stack: ' + (saveErr.stack || 'n/a') });
            throw saveErr;
        }
    }

    function summarize(summaryContext) {
        summaryContext.mapSummary.errors.iterator().each(function (key, error) {
            log.error({ title: 'IC PO IR | Map Error Summary', details: 'key: ' + key + ' | error: ' + error });
            return true;
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
});