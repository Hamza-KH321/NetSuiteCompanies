/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || IF SO InvDetails Sync
 */
define(['N/record', 'N/log', 'N/search'], function (record, log, search) {

    var IBRAND_SUBSIDIARY = '3';

    function afterSubmit(context) {
        try {

            if (context.type != context.UserEventType.CREATE &&
                context.type != context.UserEventType.EDIT) {
                log.debug('Exit', 'Not CREATE/EDIT - ' + context.type);
                return;
            }

            var ifRec = context.newRecord;

            var createdFrom = ifRec.getValue({ fieldId: 'createdfrom' });
            log.debug('createdFrom', createdFrom);

            if (!createdFrom) {
                log.debug('Exit', 'No createdfrom on fulfillment');
                return;
            }

            // read the source transaction without loading it
            var src = search.lookupFields({
                type: search.Type.TRANSACTION,
                id: createdFrom,
                columns: ['type', 'subsidiary', 'custbody_vs_consignment_inventory_tran']
            });

            var srcType = src.type && src.type.length ? src.type[0].value : '';
            var subsidiary = src.subsidiary && src.subsidiary.length ? src.subsidiary[0].value : '';
            var transferId = src.custbody_vs_consignment_inventory_tran &&
                src.custbody_vs_consignment_inventory_tran.length ?
                src.custbody_vs_consignment_inventory_tran[0].value : '';

            log.debug('Source', 'type=' + srcType + ' subsidiary=' + subsidiary + ' transferId=' + transferId);

            if (srcType !== 'SalesOrd') {
                log.debug('Exit', 'Created from is not a Sales Order');
                return;
            }

            if (String(subsidiary) !== IBRAND_SUBSIDIARY || transferId) {
                log.debug('Exit', 'Condition not met (subsidiary != 3 or inventory transfer exists)');
                return;
            }

            syncFromFulfillments(createdFrom);

        } catch (e) {
            log.error('afterSubmit ERROR', e);
        }
    }

    /**
     * Builds the inventory details JSON from all item fulfillments of the sales order
     * and writes it to custcol_vs_inventory_details_sync.
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

                // only touch the line if the value really changed
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