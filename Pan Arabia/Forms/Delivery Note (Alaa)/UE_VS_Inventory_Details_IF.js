/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Inventory Details IF
 */

define(['N/log', 'N/format', 'N/search'], function (log, format, search) {

    function beforeSubmit(context) {
        try {

            var record = context.newRecord;

            log.debug('beforeSubmit started', {
                recordType: record.type,
                recordId: record.id
            });

            if (record.type != 'itemfulfillment') {
                return;
            }

            var lineCount = record.getLineCount({
                sublistId: 'item'
            });

            log.debug('Item Fulfillment line count', lineCount);

            for (var i = 0; i < lineCount; i++) {

                try {

                    var inventoryDetail = record.getSublistSubrecord({
                        sublistId: 'item',
                        fieldId: 'inventorydetail',
                        line: i
                    });

                    if (!inventoryDetail) {
                        log.debug('No inventory detail', {
                            line: i
                        });
                        continue;
                    }

                    var assignmentCount = inventoryDetail.getLineCount({
                        sublistId: 'inventoryassignment'
                    });

                    log.debug('Inventory assignment count', {
                        line: i,
                        count: assignmentCount
                    });

                    var detailsArray = [];

                    for (var j = 0; j < assignmentCount; j++) {

                        var lotNumberId = inventoryDetail.getSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'issueinventorynumber',
                            line: j
                        });

                        if (!lotNumberId) {
                            lotNumberId = inventoryDetail.getSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'receiptinventorynumber',
                                line: j
                            });
                        }

                        var lotNumber = lotNumberId || '';

                        if (lotNumberId) {
                            try {

                                var inventoryNumberData = search.lookupFields({
                                    type: 'inventorynumber',
                                    id: lotNumberId,
                                    columns: ['inventorynumber']
                                });

                                if (inventoryNumberData.inventorynumber) {
                                    lotNumber = inventoryNumberData.inventorynumber;
                                }

                            } catch (lotError) {

                                log.error('Error getting inventory number', {
                                    line: i,
                                    assignmentLine: j,
                                    inventoryNumberId: lotNumberId,
                                    name: lotError.name,
                                    message: lotError.message,
                                    stack: lotError.stack
                                });

                            }
                        }

                        var quantity = inventoryDetail.getSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'quantity',
                            line: j
                        });

                        var expirationDate = inventoryDetail.getSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'expirationdate',
                            line: j
                        });

                        var formattedDate = '';

                        if (expirationDate) {
                            formattedDate = format.format({
                                value: expirationDate,
                                type: format.Type.DATE
                            });
                        }

                        var status = inventoryDetail.getSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'inventorystatus',
                            line: j
                        });

                        var statusText = status || '';

                        if (status) {
                            try {

                                var statusData = search.lookupFields({
                                    type: 'inventorystatus',
                                    id: status,
                                    columns: ['name']
                                });

                                if (statusData.name) {
                                    statusText = statusData.name;
                                }

                            } catch (statusError) {

                                log.error('Error getting inventory status', {
                                    line: i,
                                    assignmentLine: j,
                                    statusId: status,
                                    name: statusError.name,
                                    message: statusError.message,
                                    stack: statusError.stack
                                });

                            }
                        }

                        var detail = {
                            lotNumber: lotNumber,
                            quantity: Number(quantity) || 0,
                            expirationdate: formattedDate,
                            status: statusText
                        };

                        detailsArray.push(detail);

                        log.debug('Inventory assignment', {
                            line: i,
                            assignmentLine: j,
                            detail: detail
                        });
                    }

                    if (detailsArray.length > 0) {

                        var jsonValue = JSON.stringify(detailsArray);

                        record.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_vs_inventory_details_json',
                            line: i,
                            value: jsonValue
                        });

                        log.debug('Inventory JSON updated', {
                            line: i,
                            json: jsonValue
                        });
                    }

                } catch (e) {

                    log.error('Error processing item line ' + i, {
                        name: e.name,
                        message: e.message,
                        stack: e.stack
                    });
                }
            }

            log.debug('beforeSubmit completed');

        } catch (e) {

            log.error('Error in beforeSubmit', {
                name: e.name,
                message: e.message,
                stack: e.stack
            });
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});