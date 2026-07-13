/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Consignment Sync Inventory Detail
 */
define(['N/record', 'N/log'], function (record, log) {

    function afterSubmit(context) {
        try {

            if (context.type != context.UserEventType.EDIT) {
                log.debug('Exit', 'Not EDIT');
                return;
            }

            var newRec = context.newRecord;

            var isConsignment = newRec.getValue({ fieldId: 'custbody_vs_consignment_order' });
            log.debug('isConsignment', isConsignment);

            if (isConsignment != true && isConsignment != 'T') {
                log.debug('Exit', 'Not consignment');
                return;
            }

            var transferId = newRec.getValue({ fieldId: 'custbody_vs_consignment_inventory_tran' });
            log.debug('transferId', transferId);

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

    return {
        afterSubmit: afterSubmit
    };

});