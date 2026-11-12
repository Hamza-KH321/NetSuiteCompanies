/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Consignment Sync Inventory Detail
 */
define(['N/record', 'N/log', 'N/search'], function (record, log, search) {

    var IBRAND_SUBSIDIARY = '3';

    function afterSubmit(context) {
        try {

            if (context.type != context.UserEventType.EDIT) {
                log.debug('Exit', 'Not EDIT');
                return;
            }

            var newRec = context.newRecord;

            var transferId = newRec.getValue({ fieldId: 'custbody_vs_consignment_inventory_tran' });
            log.debug('transferId', transferId);

            // NEW: iBrand + no inventory transfer => take inventory details from the item fulfillments
            var subsidiary = newRec.getValue({ fieldId: 'subsidiary' });
            log.debug('subsidiary', subsidiary);

            if (String(subsidiary) === IBRAND_SUBSIDIARY && !transferId) {
                log.debug('Flow', 'iBrand without transfer - syncing from fulfillments');
                syncFromFulfillments(newRec.id);
                return;
            }

            // EXISTING LOGIC (inventory transfer) - unchanged
            var isConsignment = newRec.getValue({ fieldId: 'custbody_vs_consignment_order' });
            log.debug('isConsignment', isConsignment);

            if (isConsignment != true && isConsignment != 'T') {
                log.debug('Exit', 'Not consignment');
                return;
            }

            if (!transferId) {
                log.error('Missing Transfer ID', 'custbody_vs_consignment_inventory_tran is empty');
                return;
            }

            var itRec = record.load({
                type: 'inventorytransfer',
                id: transferId,
                isDynamic: false
            });

            var itemMap = {};

            var itLineCount = itRec.getLineCount({ sublistId: 'inventory' });
            log.debug('IT Line Count', itLineCount);

            for (var i = 0; i < itLineCount; i++) {
                try {

                    var itemId = itRec.getSublistValue({
                        sublistId: 'inventory',
                        fieldId: 'item',
                        line: i
                    });

                    var invDetail = itRec.getSublistSubrecord({
                        sublistId: 'inventory',
                        fieldId: 'inventorydetail',
                        line: i
                    });

                    if (!invDetail) {
                        log.debug('No inv detail on IT line', i);
                        continue;
                    }

                    var assignCount = invDetail.getLineCount({ sublistId: 'inventoryassignment' });

                    var arrLots = [];

                    for (var j = 0; j < assignCount; j++) {

                        var lot = invDetail.getSublistText({
                            sublistId: 'inventoryassignment',
                            fieldId: 'issueinventorynumber',
                            line: j
                        });

                        // fallback just in case
                        if (!lot) {
                            lot = invDetail.getSublistText({
                                sublistId: 'inventoryassignment',
                                fieldId: 'receiptinventorynumber',
                                line: j
                            });
                        }

                        log.debug('Resolved Lot Number', lot);

                        var qty = invDetail.getSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'quantity',
                            line: j
                        });

                        var expDateRaw = invDetail.getSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'expirationdate',
                            line: j
                        });

                        var expDate = '';

                        try {
                            if (expDateRaw) {
                                var d = new Date(expDateRaw);

                                var day = d.getDate();
                                var month = d.getMonth() + 1;
                                var year = d.getFullYear();

                                if (day < 10) {
                                    day = '0' + day;
                                }

                                if (month < 10) {
                                    month = '0' + month;
                                }

                                expDate = day + '/' + month + '/' + year;
                            }

                            log.debug('Formatted Exp Date', expDate);

                        } catch (eDate) {
                            log.error('Date Format Error', eDate);
                        }

                        var obj = {
                            lotNumber: lot ? lot + '' : '',
                            quantity: qty ? qty + '' : '0',
                            expirationDate: expDate ? expDate + '' : ''
                        };

                        arrLots.push(obj);
                    }

                    if (!itemMap[itemId]) {
                        itemMap[itemId] = [];
                    }

                    // merge all lots for same item
                    for (var x = 0; x < arrLots.length; x++) {
                        itemMap[itemId].push(arrLots[x]);
                    }

                    log.debug('Mapped Item', itemId + ' => ' + JSON.stringify(arrLots));

                } catch (eLine) {
                    log.error('Error IT line ' + i, eLine);
                }
            }

            var soRec = record.load({
                type: record.Type.SALES_ORDER,
                id: newRec.id,
                isDynamic: false
            });

            var soLineCount = soRec.getLineCount({ sublistId: 'item' });
            log.debug('SO Line Count', soLineCount);

            for (var k = 0; k < soLineCount; k++) {
                try {

                    var soItem = soRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: k
                    });

                    if (!itemMap[soItem]) {
                        continue;
                    }

                    var jsonStr = JSON.stringify(itemMap[soItem]);

                    log.debug('Updating SO Line', 'Line ' + k + ' Item ' + soItem + ' JSON ' + jsonStr);

                    // 🔴 CHANGE FIELD ID IF NEEDED
                    soRec.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_vs_inventory_details_sync',
                        line: k,
                        value: jsonStr
                    });

                } catch (eSoLine) {
                    log.error('Error SO line ' + k, eSoLine);
                }
            }

            var savedId = soRec.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            log.audit('SO Updated Successfully', savedId);

        } catch (e) {
            log.error('afterSubmit ERROR', e);
        }
    }

    /**
     * NEW: builds the inventory details JSON from all item fulfillments of the sales order.
     * Fulfillment lines are matched to sales order lines by orderline (= SO line id),
     * so multiple fulfillments and repeated items are handled correctly.
     */
    function syncFromFulfillments(soId) {

        var fulfillmentIds = getFulfillmentIds(soId);
        log.debug('Fulfillment IDs', JSON.stringify(fulfillmentIds));

        if (!fulfillmentIds.length) {
            log.audit('Exit', 'No fulfillments found for SO ' + soId);
            return;
        }

        var lineMap = {};

        for (var f = 0; f < fulfillmentIds.length; f++) {
            try {

                var ifRec = record.load({
                    type: record.Type.ITEM_FULFILLMENT,
                    id: fulfillmentIds[f],
                    isDynamic: false
                });

                var ifLineCount = ifRec.getLineCount({ sublistId: 'item' });
                log.debug('IF ' + fulfillmentIds[f] + ' Line Count', ifLineCount);

                for (var i = 0; i < ifLineCount; i++) {
                    try {

                        var itemReceive = ifRec.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'itemreceive',
                            line: i
                        });

                        // skip lines that were not fulfilled
                        if (itemReceive === false || itemReceive === 'F') {
                            continue;
                        }

                        var orderLine = ifRec.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'orderline',
                            line: i
                        });

                        if (!orderLine) {
                            continue;
                        }

                        var arrLots = getLotsFromLine(ifRec, 'item', i);

                        if (!arrLots.length) {
                            log.debug('No lots on IF line', 'IF ' + fulfillmentIds[f] + ' line ' + i);
                            continue;
                        }

                        var key = String(orderLine);

                        if (!lineMap[key]) {
                            lineMap[key] = [];
                        }

                        // merge lots coming from different fulfillments for the same SO line
                        for (var x = 0; x < arrLots.length; x++) {
                            lineMap[key].push(arrLots[x]);
                        }

                        log.debug('Mapped SO line', key + ' => ' + JSON.stringify(arrLots));

                    } catch (eIfLine) {
                        log.error('Error IF ' + fulfillmentIds[f] + ' line ' + i, eIfLine);
                    }
                }

            } catch (eIf) {
                log.error('Error loading IF ' + fulfillmentIds[f], eIf);
            }
        }

        var soRec = record.load({
            type: record.Type.SALES_ORDER,
            id: soId,
            isDynamic: false
        });

        var soLineCount = soRec.getLineCount({ sublistId: 'item' });
        log.debug('SO Line Count', soLineCount);

        var changed = false;

        for (var k = 0; k < soLineCount; k++) {
            try {

                var soLineId = soRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'line',
                    line: k
                });

                var lots = lineMap[String(soLineId)];

                if (!lots) {
                    continue;
                }

                var jsonStr = JSON.stringify(lots);

                var currentVal = soRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_vs_inventory_details_sync',
                    line: k
                });

                // only touch the line if the value really changed (avoids re-trigger loops)
                if (currentVal === jsonStr) {
                    continue;
                }

                log.debug('Updating SO Line', 'Line ' + k + ' LineId ' + soLineId + ' JSON ' + jsonStr);

                soRec.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_vs_inventory_details_sync',
                    line: k,
                    value: jsonStr
                });

                changed = true;

            } catch (eSoLine) {
                log.error('Error SO line ' + k, eSoLine);
            }
        }

        if (!changed) {
            log.audit('No changes', 'SO ' + soId + ' already up to date');
            return;
        }

        var savedId = soRec.save({
            enableSourcing: true,
            ignoreMandatoryFields: true
        });

        log.audit('SO Updated Successfully (from fulfillments)', savedId);
    }

    function getFulfillmentIds(soId) {
        var ids = [];

        var ifSearch = search.create({
            type: search.Type.ITEM_FULFILLMENT,
            filters: [
                ['createdfrom', 'anyof', soId],
                'AND',
                ['mainline', 'is', 'T']
            ],
            columns: ['internalid']
        });

        ifSearch.run().each(function (result) {
            ids.push(result.id);
            return true;
        });

        return ids;
    }

    function getLotsFromLine(rec, sublistId, line) {
        var arrLots = [];

        try {
            var invDetail = rec.getSublistSubrecord({
                sublistId: sublistId,
                fieldId: 'inventorydetail',
                line: line
            });

            if (!invDetail) {
                return arrLots;
            }

            var assignCount = invDetail.getLineCount({ sublistId: 'inventoryassignment' });

            for (var j = 0; j < assignCount; j++) {

                var lot = invDetail.getSublistText({
                    sublistId: 'inventoryassignment',
                    fieldId: 'issueinventorynumber',
                    line: j
                });

                // fallback just in case
                if (!lot) {
                    lot = invDetail.getSublistText({
                        sublistId: 'inventoryassignment',
                        fieldId: 'receiptinventorynumber',
                        line: j
                    });
                }

                var qty = invDetail.getSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'quantity',
                    line: j
                });

                var expDateRaw = invDetail.getSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'expirationdate',
                    line: j
                });

                arrLots.push({
                    lotNumber: lot ? lot + '' : '',
                    quantity: qty ? qty + '' : '0',
                    expirationDate: formatDate(expDateRaw)
                });
            }

        } catch (e) {
            log.debug('getLotsFromLine', 'No inventory detail on line ' + line + ' - ' + e);
        }

        return arrLots;
    }

    function formatDate(expDateRaw) {
        try {
            if (!expDateRaw) {
                return '';
            }

            var d = new Date(expDateRaw);

            var day = d.getDate();
            var month = d.getMonth() + 1;
            var year = d.getFullYear();

            if (day < 10) {
                day = '0' + day;
            }

            if (month < 10) {
                month = '0' + month;
            }

            return day + '/' + month + '/' + year;

        } catch (eDate) {
            log.error('Date Format Error', eDate);
            return '';
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});