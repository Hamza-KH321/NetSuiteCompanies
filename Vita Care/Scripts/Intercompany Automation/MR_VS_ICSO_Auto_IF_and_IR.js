/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 * @fileName MR || ICSO Auto IF and IR
 */

define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    var CONFIG = {
        icpoIRField: 'custbody_vs_intercompany_ir',
        fulfillmentCreatedField: 'custbody_vs_ic_fulfilment_created'
    };

    function getInputData() {

        var salesorderSearchObj = search.create({
            type: "salesorder",
            settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
            filters:
                [
                    ["type", "anyof", "SalesOrd"],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["mainname", "anyof", "520118"],
                    "AND",
                    ["intercotransaction", "noneof", "@NONE@"],
                    "AND",
                    ["subsidiary", "anyof", "5"],
                    // "AND",
                    // ["status", "anyof", "SalesOrd:A"],
                    "AND",
                    ["internalid", "anyof", "6044558"]
                ],
            columns:
                [
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "tranid", label: "Document Number" }),
                    search.createColumn({ name: "mainname", label: "Main Line Name" }),
                    search.createColumn({ name: "intercotransaction", label: "Paired Intercompany Transaction" }),
                    search.createColumn({ name: "trandate", label: "Date" }),
                    search.createColumn({ name: "statusref", label: "Status" }),
                    search.createColumn({ name: "custbody_vs_ic_fulfilment_created", label: "IC Fulfilment Created" })
                ]
        });

        return salesorderSearchObj;
    }

    function map(context) {
        var result = JSON.parse(context.value);
        var soId = result.id;

        try {

            // intercotransaction comes back as a join-field array, same shape as mainname
            var intercoRefs = result.values.intercotransaction;

            log.debug({ title: 'IC SO | Raw intercotransaction', details: 'SO ' + soId + ' | ' + JSON.stringify(intercoRefs) });

            var poId = null;

            if (Array.isArray(intercoRefs)) {
                poId = intercoRefs.length ? intercoRefs[0].value : null;
            } else if (intercoRefs && typeof intercoRefs === 'object') {
                poId = intercoRefs.value || null;
            } else if (intercoRefs) {
                poId = intercoRefs;
            }

            if (!poId) {
                log.error({ title: 'IC SO | No ICPO', details: 'SO ' + soId + ' has no intercompany transaction linked' });
                return;
            }

            // step 1: item fulfillment (create if it doesn't already exist)
            var fulfillmentId = getExistingFulfillmentId(soId);

            if (!fulfillmentId) {

                var irId = getLinkedIRFromICPO(poId);

                if (!irId) {
                    log.error({ title: 'IC SO | No IR Found', details: 'ICPO ' + poId + ' has no linked IR. SO: ' + soId });
                    return;
                }

                var invDetailsFromIR = getInventoryDetailsFromIR(irId);

                fulfillmentId = createItemFulfillment(soId, invDetailsFromIR);
                log.audit({ title: 'IC SO | Fulfillment Created', details: 'IF: ' + fulfillmentId + ' | SO: ' + soId });

                flagFulfillmentCreated(fulfillmentId, soId);

            } else {
                log.debug({ title: 'IC SO | Fulfillment Exists', details: 'IF: ' + fulfillmentId + ' | SO: ' + soId });
            }

            // step 2: item receipt on the ICPO (create if it doesn't already exist)
            if (itemReceiptAlreadyExists(poId)) {
                log.audit({ title: 'IC SO | IR Skipped', details: 'Item Receipt already exists. PO: ' + poId });
            } else {
                var invDetailsFromIF = getInventoryDetailsFromFulfillment(fulfillmentId);
                var receiptId = createItemReceipt(poId, invDetailsFromIF);
                log.audit({ title: 'IC SO | Receipt Created', details: 'IR: ' + receiptId + ' | PO: ' + poId + ' | IF: ' + fulfillmentId });
            }

            // var invoiceId = createInvoiceFromSalesOrder(soId);
            // log.audit({ title: 'IC SO | Invoice Created', details: 'Invoice: ' + invoiceId + ' | SO: ' + soId });

        } catch (e) {
            log.error({ title: 'IC SO | Map Error', details: 'SO ' + soId + ' | ' + e.name + ': ' + e.message + ' | stack: ' + (e.stack || 'n/a') });
        }
    }

    // ---------- fulfillment side (mirrors IR -> IF lot assignment) ----------

    // returns existing fulfillment internal id for this SO, or null
    function getExistingFulfillmentId(soId) {
        var fulfillmentId = null;

        var ifSearch = search.create({
            type: search.Type.ITEM_FULFILLMENT,
            filters: [
                ['createdfrom', 'anyof', soId],
                'AND',
                ['mainline', 'is', 'T']
            ],
            columns: ['internalid']
        });

        ifSearch.run().each(function (res) {
            fulfillmentId = res.getValue({ name: 'internalid' });
            return false;
        });

        return fulfillmentId;
    }

    function getLinkedIRFromICPO(poId) {
        var poRecord = record.load({
            type: record.Type.PURCHASE_ORDER,
            id: poId,
            isDynamic: false
        });

        var irId = poRecord.getValue({ fieldId: CONFIG.icpoIRField });

        log.debug({ title: 'IC SO | ICPO IR field value', details: 'PO ' + poId + ' | ' + CONFIG.icpoIRField + ' = ' + irId });

        return irId || null;
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
        fulfillment.setValue({ fieldId: CONFIG.fulfillmentCreatedField, value: true });

        try {
            return fulfillment.save({ enableSourcing: false, ignoreMandatoryFields: true });
        } catch (saveErr) {
            log.error({ title: 'IC SO | Fulfillment Save Error', details: 'SO ' + soId + ' | ' + saveErr.name + ': ' + saveErr.message + ' | stack: ' + (saveErr.stack || 'n/a') });
            throw saveErr;
        }
    }

    // flags both the fulfillment (already set inline pre-save) and the sales order
    function flagFulfillmentCreated(fulfillmentId, soId) {
        try {
            record.submitFields({
                type: record.Type.SALES_ORDER,
                id: soId,
                values: (function () {
                    var values = {};
                    values[CONFIG.fulfillmentCreatedField] = true;
                    return values;
                })(),
                options: { enableSourcing: false, ignoreMandatoryFields: true }
            });
        } catch (flagErr) {
            log.error({ title: 'IC SO | SO Flag Error', details: 'SO ' + soId + ' | IF ' + fulfillmentId + ' | ' + flagErr.name + ': ' + flagErr.message });
        }
    }

    // ---------- receipt side (mirrors IF -> IR lot assignment) ----------

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

    // mirror of the IR-side reader above, but reads issued lots off the Item Fulfillment
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
                                log.error({ title: 'IC SO | Lot Text Missing', details: 'item ' + itemId + ' | no lot text on IF line' });
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
                                    title: 'IC SO | IR Inventory Assignment Error',
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
            log.error({ title: 'IC SO | IR Save Error', details: 'PO ' + poId + ' | ' + saveErr.name + ': ' + saveErr.message + ' | stack: ' + (saveErr.stack || 'n/a') });
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

    function summarize(summaryContext) {
        summaryContext.mapSummary.errors.iterator().each(function (key, error) {
            log.error({ title: 'IC SO | Map Error Summary', details: 'key: ' + key + ' | error: ' + error });
            return true;
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
});