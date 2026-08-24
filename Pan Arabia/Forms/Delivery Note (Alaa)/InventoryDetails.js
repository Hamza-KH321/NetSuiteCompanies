/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || InventoryDetails.js
 */

define(['N/log', 'N/format', 'N/search'],
    function (log, format, search) {

        function beforeSubmit(context) {
            try {
                log.debug('beforeSubmit started', {
                    eventType: context.type
                });

                var newRecord = context.newRecord;
                var recordType = newRecord.type;
                var recordId = newRecord.id;

                log.debug('Record information', {
                    recordType: recordType,
                    recordId: recordId
                });

                if (recordType != 'itemfulfillment') {
                    log.debug('Record skipped', 'Record is not Item Fulfillment');
                    return;
                }

                processItemFulfillment(newRecord);

                log.debug('beforeSubmit completed', {
                    recordId: recordId
                });

            } catch (e) {
                log.error('Error in beforeSubmit', {
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                });
            }
        }

        function processItemFulfillment(itemFulfillment) {
            try {
                var lineCount = itemFulfillment.getLineCount({
                    sublistId: 'item'
                });

                log.debug('Item Fulfillment line count', lineCount);

                for (var i = 0; i < lineCount; i++) {
                    try {
                        processItemLine(itemFulfillment, i);

                    } catch (e) {
                        log.error('Error processing item line ' + i, {
                            name: e.name,
                            message: e.message,
                            stack: e.stack
                        });
                    }
                }

            } catch (e) {
                log.error('Error in processItemFulfillment', {
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                });

                throw e;
            }
        }

        function processItemLine(itemFulfillment, line) {
            try {
                var isReceived = itemFulfillment.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'itemreceive',
                    line: line
                });

                log.debug('Line ' + line + ' itemreceive', isReceived);

                if (!isReceived) {
                    log.debug('Line ' + line + ' skipped', 'Item is not received');
                    return;
                }

                var itemId = itemFulfillment.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: line
                });

                var itemName = itemFulfillment.getSublistText({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: line
                });

                var itemType = itemFulfillment.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'itemtype',
                    line: line
                });

                var rate = itemFulfillment.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    line: line
                });

                var tax = itemFulfillment.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'tax1amt',
                    line: line
                });

                var totalQuantity = itemFulfillment.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'initquantity',
                    line: line
                });

                log.debug('Line ' + line + ' information', {
                    itemId: itemId,
                    itemName: itemName,
                    itemType: itemType,
                    rate: rate,
                    tax: tax,
                    totalQuantity: totalQuantity
                });

                var detailsArray = [];

                if (itemType == 'Service') {

                    detailsArray.push({
                        l: '',
                        q: '',
                        tnotax: '',
                        tAmttax: '',
                        taxq: '',
                        exp: '',
                        s: ''
                    });

                    log.debug('Service item details', {
                        line: line,
                        details: detailsArray
                    });

                } else {

                    detailsArray = buildInventoryDetails(
                        itemFulfillment,
                        line,
                        itemId,
                        rate,
                        tax,
                        totalQuantity
                    );
                }

                log.debug('Final details array line ' + line, detailsArray);

                if (detailsArray.length > 0) {

                    itemFulfillment.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_vs_inventory_details_json',
                        line: line,
                        value: JSON.stringify(detailsArray)
                    });

                    log.debug('Inventory JSON updated', {
                        line: line,
                        value: JSON.stringify(detailsArray)
                    });
                }

            } catch (e) {
                log.error('Error in processItemLine line ' + line, {
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                });

                throw e;
            }
        }

        function buildInventoryDetails(
            itemFulfillment,
            line,
            itemId,
            rate,
            tax,
            totalQuantity
        ) {
            var detailsArray = [];

            try {
                var inventoryDetail = itemFulfillment.getSublistSubrecord({
                    sublistId: 'item',
                    fieldId: 'inventorydetail',
                    line: line
                });

                if (!inventoryDetail) {
                    log.debug('No inventory detail found', {
                        line: line,
                        itemId: itemId
                    });

                    return detailsArray;
                }

                var inventoryDetailCount = inventoryDetail.getLineCount({
                    sublistId: 'inventoryassignment'
                });

                log.debug('Inventory detail count line ' + line, inventoryDetailCount);

                var taxValue = Number(tax) || 0;
                var quantityValue = Number(totalQuantity) || 0;
                var rateValue = Number(rate) || 0;

                var taxForEachQty = 0;

                if (quantityValue != 0) {
                    taxForEachQty = taxValue / quantityValue;
                }

                log.debug('Tax calculation line ' + line, {
                    tax: taxValue,
                    quantity: quantityValue,
                    taxForEachQty: taxForEachQty
                });

                for (var j = 0; j < inventoryDetailCount; j++) {
                    try {

                        inventoryDetail.selectLine({
                            sublistId: 'inventoryassignment',
                            line: j
                        });

                        var detail = buildInventoryAssignmentDetail(
                            inventoryDetail,
                            j,
                            itemId,
                            rateValue,
                            taxForEachQty,
                            line
                        );

                        if (detail) {
                            detailsArray.push(detail);
                        }

                    } catch (e) {
                        log.error('Error processing inventory assignment', {
                            transactionLine: line,
                            inventoryLine: j,
                            name: e.name,
                            message: e.message,
                            stack: e.stack
                        });
                    }
                }

            } catch (e) {
                log.error('Error in buildInventoryDetails', {
                    line: line,
                    itemId: itemId,
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                });

                throw e;
            }

            return detailsArray;
        }

        function buildInventoryAssignmentDetail(
            inventoryDetail,
            inventoryLine,
            itemId,
            rate,
            taxForEachQty,
            transactionLine
        ) {
            try {

                var expirationDate = inventoryDetail.getCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'expirationdate'
                });

                var formattedDate = '';

                if (expirationDate) {
                    formattedDate = format.format({
                        value: expirationDate,
                        type: format.Type.DATE
                    });
                }

                var lotNumber = inventoryDetail.getCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'issueinventorynumber'
                });

                if (!lotNumber) {
                    lotNumber = inventoryDetail.getCurrentSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'receiptinventorynumber'
                    });
                }

                var quantity = inventoryDetail.getCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'quantity'
                });

                var status = inventoryDetail.getCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'inventorystatus_display'
                });

                if (!status) {
                    status = inventoryDetail.getCurrentSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'inventorystatus'
                    });
                }

                var quantityValue = Number(quantity) || 0;

                var taxForLotQty = taxForEachQty * quantityValue;

                var totalAmountWithoutTax = quantityValue * rate;

                var totalAmountWithTax =
                    totalAmountWithoutTax + taxForLotQty;

                log.debug('Inventory assignment raw values', {
                    transactionLine: transactionLine,
                    inventoryLine: inventoryLine,
                    lotNumber: lotNumber,
                    quantity: quantityValue,
                    expirationDate: formattedDate,
                    status: status
                });

                var productionDate = getProductionDate(
                    lotNumber,
                    itemId
                );

                var detail = {
                    lotNumber: lotNumber || '',
                    quantity: quantityValue,
                    totalAnountWithoutTax: totalAmountWithoutTax,
                    totalAnountWithTax: totalAmountWithTax,
                    taxForLotQTY: taxForLotQty,
                    expirationdate: formattedDate,
                    status: status || '',
                    ProducDate: productionDate
                };

                log.debug('Inventory assignment detail', {
                    transactionLine: transactionLine,
                    inventoryLine: inventoryLine,
                    detail: detail
                });

                return detail;

            } catch (e) {
                log.error('Error in buildInventoryAssignmentDetail', {
                    transactionLine: transactionLine,
                    inventoryLine: inventoryLine,
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                });

                throw e;
            }
        }

        function getProductionDate(lotNumber, itemId) {
            try {

                if (!lotNumber || !itemId) {

                    log.debug('Production date search skipped', {
                        lotNumber: lotNumber,
                        itemId: itemId
                    });

                    return '';
                }

                var inventoryNumberSearch = search.create({
                    type: 'inventorynumber',
                    filters: [
                        ['inventorynumber', 'is', lotNumber],
                        'AND',
                        ['item', 'anyof', itemId]
                    ],
                    columns: [
                        search.createColumn({
                            name: 'custitemnumber_vs_productiondate'
                        })
                    ]
                });

                var results = inventoryNumberSearch.run().getRange({
                    start: 0,
                    end: 1
                });

                if (results && results.length > 0) {

                    var productionDate = results[0].getValue({
                        name: 'custitemnumber_vs_productiondate'
                    });

                    log.debug('Production date found', {
                        lotNumber: lotNumber,
                        itemId: itemId,
                        productionDate: productionDate
                    });

                    return productionDate || '';
                }

                log.debug('Production date not found', {
                    lotNumber: lotNumber,
                    itemId: itemId
                });

                return '';

            } catch (e) {

                log.error('Error getting production date', {
                    lotNumber: lotNumber,
                    itemId: itemId,
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                });

                return '';
            }
        }

        return {
            beforeSubmit: beforeSubmit
        };
    });