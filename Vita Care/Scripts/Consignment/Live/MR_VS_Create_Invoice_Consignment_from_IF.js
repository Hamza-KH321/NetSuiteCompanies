/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Create Invoice Consignment from IF
 */

define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {
        try {

            log.debug('GET INPUT DATA', 'Start loading search');

            return search.create({
                type: "itemfulfillment",
                filters: [
                    ["type", "anyof", "ItemShip"],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["custbody_vs_consignment_order", "is", "T"],
                    "AND",
                    ["custbody_vs_invoice_created", "is", "F"]
                ],
                columns: [
                    "internalid",
                    "createdfrom"
                ]
            });

        } catch (e) {
            log.error('GET INPUT ERROR', e);
        }
    }

    function map(context) {
        try {

            var searchResult = JSON.parse(context.value);

            var fulfillmentId = searchResult.id;
            var createdFrom = searchResult.values.createdfrom.value;

            log.debug('MAP START', {
                fulfillmentId: fulfillmentId,
                createdFrom: createdFrom
            });

            // Load IF
            var ifRecord = record.load({
                type: record.Type.ITEM_FULFILLMENT,
                id: fulfillmentId,
                isDynamic: true
            });

            // Transform SO → Invoice
            var invoice = record.transform({
                fromType: record.Type.SALES_ORDER,
                fromId: createdFrom,
                toType: record.Type.INVOICE,
                isDynamic: true
            });

            log.debug('INVOICE CREATED', 'Transform success');

            var ifLineCount = ifRecord.getLineCount({ sublistId: 'item' });
            var invLineCount = invoice.getLineCount({ sublistId: 'item' });

            log.debug('LINE COUNTS', {
                ifLines: ifLineCount,
                invLines: invLineCount
            });

            for (var i = 0; i < invLineCount; i++) {
                try {

                    invoice.selectLine({ sublistId: 'item', line: i });

                    var invItem = invoice.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' });

                    log.debug('PROCESS INVOICE LINE', {
                        line: i,
                        item: invItem
                    });

                    var matchedLine = -1;

                    for (var j = 0; j < ifLineCount; j++) {

                        var ifItem = ifRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: j
                        });

                        if (ifItem == invItem) {
                            matchedLine = j;
                            break;
                        }
                    }

                    // ❌ Remove lines NOT in this fulfillment
                    if (matchedLine == -1) {

                        log.debug('REMOVE LINE NOT IN IF', invItem);

                        invoice.removeLine({ sublistId: 'item', line: i });

                        i--;
                        invLineCount--;

                        continue;
                    }

                    log.debug('MATCH FOUND', {
                        invLine: i,
                        ifLine: matchedLine
                    });

                    // ✅ Set correct quantity from IF
                    var ifQty = ifRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: matchedLine });

                    invoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: ifQty });

                    // 🔹 Inventory Detail Copy
                    var invDetailIF = null;

                    try {
                        ifRecord.selectLine({ sublistId: 'item', line: matchedLine });

                        invDetailIF = ifRecord.getCurrentSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail'
                        });

                    } catch (e) {
                        log.debug('NO INV DETAIL ON IF', matchedLine);
                    }

                    if (invDetailIF) {

                        var invDetailInv = invoice.getCurrentSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail'
                        });

                        if (invDetailInv) {

                            // Clear existing
                            var existingCount = invDetailInv.getLineCount({sublistId: 'inventoryassignment'});

                            log.debug('CLEAR EXISTING ASSIGNMENTS', existingCount);

                            for (var x = existingCount - 1; x >= 0; x--) {
                                invDetailInv.removeLine({ sublistId: 'inventoryassignment', line: x });
                            }

                            var assignCount = invDetailIF.getLineCount({ sublistId: 'inventoryassignment' });

                            log.debug('ASSIGN COUNT FROM IF', assignCount);

                            for (var k = 0; k < assignCount; k++) {

                                var lotId = invDetailIF.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', line: k });
                                var qty = invDetailIF.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', line: k });

                                log.debug('COPY INVENTORY DETAIL', {
                                    lotId: lotId,
                                    qty: qty
                                });

                                invDetailInv.selectNewLine({ sublistId: 'inventoryassignment' });

                                invDetailInv.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: lotId });
                                invDetailInv.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: qty });

                                invDetailInv.commitLine({ sublistId: 'inventoryassignment' });
                            }
                        }
                    }

                    invoice.commitLine({
                        sublistId: 'item'
                    });

                } catch (lineError) {
                    log.error('LINE ERROR', lineError);
                    throw lineError;
                }
            }

            // Save Invoice
            var invoiceId = invoice.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            log.debug('INVOICE SAVED', invoiceId);

            // Mark IF as processed
            record.submitFields({
                type: record.Type.ITEM_FULFILLMENT,
                id: fulfillmentId,
                values: {
                    custbody_vs_invoice_created: true
                }
            });

            log.debug('IF UPDATED', fulfillmentId);

        } catch (e) {
            log.error('MAP ERROR', e);
        }
    }

    return {
        getInputData: getInputData,
        map: map
    };

});