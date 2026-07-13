/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

define(['N/record', 'N/log', 'N/format', 'N/search'],
    function (record, log, format, search) {

        function afterSubmit(context) {
            try {
             // if(context.newRecord.id ==34428)
             //   return;
                var newRecord = context.newRecord;
                var recordType = newRecord.type;
                var recordId = newRecord.id;

                log.debug('Script Start', 'Record Type: ' + recordType + ', ID: ' + recordId);

                if (recordType !== 'invoice') {
                    log.debug('Exit Script', 'Not an invoice record.');
                    return;
                }

                var loadedRecord = record.load({ type: recordType, id: recordId, isDynamic: true });
                var lineCount = loadedRecord.getLineCount({ sublistId: 'item' });

                log.debug('Line Count', lineCount);

                var allLinesDetails = [];

                for (var i = 0; i < lineCount; i++) {
                    try {
                        loadedRecord.selectLine({ sublistId: 'item', line: i });
                        log.debug('Processing Line', i);

                        var itemtype = loadedRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'itemtype' });
                        var RateAfterDiscount = loadedRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'rate' });
                        var tax = loadedRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'tax1amt' });
                        var Allquantity = loadedRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity' });
                        var itemID2 = loadedRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item_display' });

                        log.debug('Item Info', {
                            itemtype: itemtype,
                            rate: RateAfterDiscount,
                            tax: tax,
                            quantity: Allquantity,
                            itemDisplay: itemID2
                        });

                        var taxForEachQTY = tax / Allquantity;
                        var detailsArray = [];

                        if (itemtype === 'Service') {
                            log.debug('Skipping Inventory Detail', 'Line ' + i + ' is Service type.');
                            detailsArray.push({
                                l: '',
                                q: '',
                                tnotax: '',
                                tAmttax: '',
                                taxq: '',
                                exp: '',
                                s: '',
                                pdate: ''
                            });
                        } else {
                            var inventoryDetail = loadedRecord.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });
                            var inventoryDetailCount = inventoryDetail.getLineCount({ sublistId: 'inventoryassignment' });

                            log.debug('Inventory Detail Count', inventoryDetailCount);

                            for (var j = 0; j < inventoryDetailCount; j++) {
                                inventoryDetail.selectLine({ sublistId: 'inventoryassignment', line: j });

                                var expirationDate = inventoryDetail.getCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'expirationdate' });
                                var formattedDate = expirationDate ? format.format({ value: expirationDate, type: format.Type.DATE }) : '';

                                var lotNumber = inventoryDetail.getCurrentSublistText({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber' }) ||
                                    inventoryDetail.getCurrentSublistText({ sublistId: 'inventoryassignment', fieldId: 'receiptinventorynumber' });

                                var QTY = inventoryDetail.getCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity' });
                                var taxForLotQTY = taxForEachQTY * QTY;
                                var totalAnountWithoutTax = Number(QTY) * Number(RateAfterDiscount);
                                var totalAnountWithTax = totalAnountWithoutTax + taxForLotQTY;
                                var inventoryStatus = inventoryDetail.getCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'inventorystatus_display' });

                                log.debug('Inventory Line', {
                                    lotNumber: lotNumber,
                                    quantity: QTY,
                                    expiration: formattedDate,
                                    taxQTY: taxForLotQTY,
                                    totalNoTax: totalAnountWithoutTax,
                                    totalWithTax: totalAnountWithTax
                                });

                                // Get Production Date
                                var inventorynumberSearchObj = search.create({
                                    type: "inventorynumber",
                                    filters: [
                                        ["inventorynumber", "is", lotNumber],
                                        "AND",
                                        ["item.name", "is", itemID2]
                                    ],
                                    columns: [
                                        search.createColumn({ name: "custitemnumber_vs_productiondate" })
                                    ]
                                });

                                var pagedData = inventorynumberSearchObj.runPaged({ pageSize: 1 });
                                var ProducDate = '';

                                if (pagedData.pageRanges.length > 0) {
                                    var page = pagedData.fetch({ index: 0 });
                                    page.data.forEach(function (result) {
                                        ProducDate = result.getValue({ name: 'custitemnumber_vs_productiondate' });
                                    });
                                }

                                log.debug('Production Date', ProducDate);

                                detailsArray.push({
                                    l: lotNumber,
                                    q: QTY,
                                    // tnotax: totalAnountWithoutTax,
                                    // tAmttax: totalAnountWithTax,
                                    // taxq: taxForLotQTY,
                                    exp: formattedDate,
                                    s: inventoryStatus,
                                    pdate: ProducDate
                                });
                            }
                        }

                        if (detailsArray.length > 0) {
                            var jsonValue = JSON.stringify(detailsArray);
                            // loadedRecord.setCurrentSublistValue({
                            //     sublistId: 'item',
                            //     fieldId: 'custcol_vs_inventory_details_json',
                            //     value: jsonValue
                            // });
                            loadedRecord.commitLine({ sublistId: 'item' });
                            log.debug('Saved JSON', jsonValue);
                        }

                        allLinesDetails.push({
                            line: i + 1,
                            details: detailsArray
                        });

                    } catch (lineErr) {
                        log.error('Error processing line ' + i, lineErr.toString());
                    }
                }

                loadedRecord.setValue({
                    fieldId: 'custbody_vs_inventory_detail',
                    value: JSON.stringify(allLinesDetails)
                });

                loadedRecord.save();
                log.debug('Record Saved', 'Invoice updated successfully');

            } catch (e) {
                log.error('Error in afterSubmit', e.toString());
            }
        }

        return {
            afterSubmit: afterSubmit
        };
    });
