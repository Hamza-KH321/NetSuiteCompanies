/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */

define(['N/record', 'N/log', 'N/format', 'N/search'],
    function (record, log, format, search) {

        function afterSubmit(context) {
            try {
                var newRecord = context.newRecord;
                var recordType = newRecord.type;
                var recordId = newRecord.id;
                log.debug('new record ', newRecord);

                var loadedRecord = record.load({ type: recordType, id: recordId, isDynamic: true });
                var lineCount = loadedRecord.getLineCount({ sublistId: 'item' });

                if (recordType == 'itemfulfillment') {
                    // Create the search object once
                    var itemfulfillmentSearchObj = search.create({
                        type: "itemfulfillment",
                        settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                        filters: [
                            ["type", "anyof", "ItemShip"],
                            "AND",
                            ["internalid", "anyof", recordId]
                        ],
                        columns: [
                            search.createColumn({ name: "custitem2", join: "item", label: "Item ID" }),
                            search.createColumn({ name: "manufacturer", join: "item", label: "Manufacturer" }),
                            search.createColumn({ name: "countryofmanufacture", join: "item", label: "Manufacturer Country" }),
                            search.createColumn({ name: "custitem5", join: "item", label: "Sales Description Arabic" })
                        ]
                    });
                    var Results = itemfulfillmentSearchObj.run().getRange({ start: 0, end: 100 });

                    for (var i = 0; i < lineCount; i++) {
                        try {
                            loadedRecord.selectLine({ sublistId: 'item', line: i });

                            if (recordType == 'itemfulfillment') {
                                var isReceived = loadedRecord.getSublistValue({ sublistId: 'item', fieldId: 'itemreceive', line: i });
                                log.debug('isReceived ', isReceived);
                                if (!isReceived) {
                                    continue;
                                }
                            }

                            var itemID = Results[i].getValue({ name: 'custitem2', join: 'item' });
                            var itemARDisc = Results[i].getValue({ name: 'custitem5', join: 'item' });
                            var itemCountry = Results[i].getValue({ name: 'countryofmanufacture', join: 'item' });
                            var itemManufacturer = Results[i].getValue({ name: 'manufacturer', join: 'item' });

                            log.debug('itemID', itemID);
                            log.debug('itemARDisc', itemARDisc);
                            log.debug('itemCountry', itemCountry);
                            log.debug('itemManufacturer', itemManufacturer);

                            var inventoryDetail = loadedRecord.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });
                            var inventoryDetailCount = inventoryDetail.getLineCount({ sublistId: 'inventoryassignment' });
                            log.debug('inventoryDetail itemful', inventoryDetail);
                            log.debug('inventoryDetailCount itemful', inventoryDetailCount);
                            var detailsArray = [];
                            for (var j = 0; j < inventoryDetailCount; j++) {
                                inventoryDetail.selectLine({ sublistId: 'inventoryassignment', line: j });
                                var expirationDate = inventoryDetail.getCurrentSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'expirationdate'
                                });

                                var formattedDate = '';
                                if (expirationDate) {
                                    formattedDate = format.format({ value: expirationDate, type: format.Type.DATE });
                                }

                                var lotNumber = inventoryDetail.getCurrentSublistText({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber' }) ||
                                    inventoryDetail.getCurrentSublistText({ sublistId: 'inventoryassignment', fieldId: 'receiptinventorynumber' });

                                var QTY = inventoryDetail.getCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity' });

                                var detail = {
                                    lotNumber: lotNumber,
                                    quantity: inventoryDetail.getCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity' }),
                                    expirationdate: formattedDate,
                                    status: inventoryDetail.getCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'inventorystatus_display' }),
                                    // itemID: itemID,
                                    // itemARDisc: itemARDisc,
                                    // itemCountry: itemCountry,
                                    // itemManufacturer: itemManufacturer
                                };
                                log.debug('detail ', detail);
                                detailsArray.push(detail);

                            }

                            if (detailsArray.length > 0) {
                                loadedRecord.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_vs_inventory_details_json',
                                    value: JSON.stringify(detailsArray)
                                });
                                loadedRecord.commitLine({ sublistId: 'item' }); // Commit the item line after changes

                            }

                            // loadedRecord.save({
                            //     enableSourcing: true,
                            //     ignoreMandatoryFields: true
                            // });

                        } catch (error) {
                            log.debug('Error processing line ' + i, error.toString());
                        }
                    }
                    loadedRecord.save();
                } else {

                    log.debug('hiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii')
                    log.debug('lineCount', lineCount)


                    for (var i = 0; i < lineCount; i++) {
                        try {
                            loadedRecord.selectLine({ sublistId: 'item', line: i });

                            if (recordType == 'itemfulfillment') {
                                var isReceived = loadedRecord.getSublistValue({ sublistId: 'item', fieldId: 'itemreceive', line: i });
                                log.debug('isReceived ', isReceived);
                                if (!isReceived) {
                                    continue;
                                }
                            }

                            var QTY = 0;
                            var RateAfterDiscount = loadedRecord.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'rate',
                            });

                            var tax = loadedRecord.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'tax1amt',
                            });

                            var Allquantity = loadedRecord.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'initquantity',
                            });

                            var itemtype = loadedRecord.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'itemtype',
                            });


                            var itemID2 = loadedRecord.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'item_display',
                            });
                            log.debug('itemID22', itemID2)


                            var taxForEachQTY = tax / Allquantity;

                            log.debug('taxForEachQTY', taxForEachQTY);


                            // log.debug('quantity', Allquantity);

                            var detailsArray = [];


                            log.debug('itemtype', itemtype);

                            if (itemtype === 'Service') {
                                var detail = {
                                    l: '',              //lotNumber
                                    q: '',               //quantity
                                    tnotax: '',  //totalAnountWithoutTax
                                    tAmttax: '',                //totalAnountWithTax
                                    taxq: '',                   //taxForLotQTY
                                    exp: '',                    //expirationdate
                                    s: ''                       //status
                                };

                                /*  var detail = {
                                    lotNumber: '',
                                    quantity: '',
                                    totalAnountWithoutTax: '',
                                    totalAnountWithTax: '',
                                    taxForLotQTY: '',
                                    expirationdate: '',
                                    status: ''
                                }; */
                                detailsArray.push(detail);


                            } else {

                                var inventoryDetail = loadedRecord.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });
                                var inventoryDetailCount = inventoryDetail.getLineCount({ sublistId: 'inventoryassignment' });
                                log.debug('inventoryDetail', inventoryDetail);
                                log.debug('inventoryDetailCount', inventoryDetailCount);
                                log.debug('lotNumber', lotNumber);

                                for (var j = 0; j < inventoryDetailCount; j++) {
                                    log.debug('inventoryDetailCount', inventoryDetailCount);

                                    inventoryDetail.selectLine({ sublistId: 'inventoryassignment', line: j });
                                    var expirationDate = inventoryDetail.getCurrentSublistValue({
                                        sublistId: 'inventoryassignment',
                                        fieldId: 'expirationdate'
                                    });

                                    var formattedDate = '';
                                    if (expirationDate) {
                                        formattedDate = format.format({ value: expirationDate, type: format.Type.DATE });
                                    }

                                    var lotNumber = inventoryDetail.getCurrentSublistText({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber' }) ||
                                        inventoryDetail.getCurrentSublistText({ sublistId: 'inventoryassignment', fieldId: 'receiptinventorynumber' });
                                    QTY = inventoryDetail.getCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity' });


                                    var taxForLotQTY = taxForEachQTY * QTY;
                                    var totalAnountWithoutTax = Number(QTY) * Number(RateAfterDiscount);
                                    var totalAnountWithTax = Number(QTY) * Number(RateAfterDiscount) + Number(taxForLotQTY);
                                    var quantity = inventoryDetail.getCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity' });

                                    log.debug('taxForLotQTY', taxForLotQTY);
                                    log.debug('totalAnountWithoutTax', totalAnountWithoutTax);
                                    log.debug('totalAnountWithTax', totalAnountWithTax);
                                    log.debug('lotNumber', lotNumber);
                                    log.debug('QTY', QTY);


                                    //Production Date
                                    var inventorynumberSearchObj = search.create({
                                        type: "inventorynumber",
                                        filters:
                                            [
                                                ["inventorynumber", "is", lotNumber],
                                                "AND",
                                                ["item", "anyof", itemID2]
                                            ],
                                        columns:
                                            [
                                                search.createColumn({ name: "inventorynumber", label: "Number" }),
                                                search.createColumn({ name: "item", label: "Item" }),
                                                search.createColumn({ name: "custitemnumber_vs_productiondate", label: "Production Date " })
                                            ]
                                    });
                                    /*         var ProductionDate = inventorynumberSearchObj.run().getRange({ start: 0, end: 1});
        
                                            var ProducDate = '';
        
                                            for (var j = 0; j < ProductionDate.length; j++) {
                                                ProducDate = ProductionDate[j].getValue({ name: 'custitemnumber_vs_productiondate' });
                                            }
                                            log.debug('ProducDate', ProducDate) */


                                    // Use runPaged to handle the search results
                                    var pagedData = inventorynumberSearchObj.runPaged({ pageSize: 1 }); // Set page size to 1 since we only need the first result
                                    var ProductionDate = [];

                                    if (pagedData.pageRanges.length > 0) {
                                        var page = pagedData.fetch({ index: 0 }); // Fetch the first page
                                        page.data.forEach(function (result) {
                                            ProductionDate.push(result);
                                        });
                                    }

                                    // Extract the production date value
                                    var ProducDate = '';
                                    if (ProductionDate.length > 0) {
                                        ProducDate = ProductionDate[0].getValue({ name: 'custitemnumber_vs_productiondate' });
                                    }
                                    log.debug('ProducDate', ProducDate);

                                    // var detail = {
                                    //     l: lotNumber,
                                    //     q: QTY,
                                    //     tnotax: totalAnountWithoutTax,
                                    //     tAmttax: totalAnountWithTax,
                                    //     taxq: taxForLotQTY,
                                    //     exp: formattedDate,
                                    //     s: inventoryDetail.getCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'inventorystatus_display' }),
                                    //     pdate: ProducDate
                                    // };

                                    var detail = {
                                        lotNumber: lotNumber,
                                        quantity: QTY,
                                        totalAnountWithoutTax: totalAnountWithoutTax,
                                        totalAnountWithTax: totalAnountWithTax,
                                        taxForLotQTY: taxForLotQTY,
                                        expirationdate: formattedDate,
                                        status: inventoryDetail.getCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'inventorystatus_display' }),
                                        ProducDate: ProducDate
                                    };
                                    log.debug('detail ', detail);
                                    detailsArray.push(detail);
                                }

                            }

                            log.debug('detailsArray ', detailsArray);

                            if (detailsArray.length > 0) {
                                loadedRecord.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_vs_inventory_details_json',
                                    value: JSON.stringify(detailsArray)
                                });

                                loadedRecord.commitLine({ sublistId: 'item' }); // Commit the item line after changes
                            }

                            //                       log.debug('QTY', QTY);

                        } catch (error) {
                            log.debug('Error processing line ' + i, error.toString());
                        }
                    }

                    loadedRecord.save();
                }

            } catch (e) {
                log.debug('Error in After Submit', e.toString());
            }
        }

        return {
            afterSubmit: afterSubmit
        };
    });
