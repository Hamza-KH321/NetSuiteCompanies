/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Update Item Description IF
 */

define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {
        try {

            log.debug('getInputData started');

            var items = {};

            var itemSearch = search.create({
                type: 'item',
                filters: [],
                columns: [
                    search.createColumn({
                        name: 'internalid'
                    }),
                    search.createColumn({
                        name: 'salesdescription'
                    })
                ]
            });

            itemSearch.run().each(function (result) {

                var itemId = result.getValue({
                    name: 'internalid'
                });

                var salesDescription = result.getValue({
                    name: 'salesdescription'
                });

                items[itemId] = salesDescription || '';

                return true;
            });

            var itemFulfillmentSearch = search.create({
                type: 'itemfulfillment',
                filters: [
                    ['internalid', 'anyof', '62363']
                ],
                columns: [
                    search.createColumn({
                        name: 'internalid'
                    })
                ]
            });

            var inputData = [];

            itemFulfillmentSearch.run().each(function (result) {

                var itemFulfillmentId = result.getValue({
                    name: 'internalid'
                });

                inputData.push({
                    itemFulfillmentId: itemFulfillmentId,
                    items: items
                });

                return true;
            });

            return inputData;

        } catch (e) {

            log.error('Error in getInputData', {
                name: e.name,
                message: e.message,
                stack: e.stack
            });

            throw e;
        }
    }

    function map(context) {
        try {

            var data = JSON.parse(context.value);

            var itemFulfillmentId = data.itemFulfillmentId;
            var items = data.items;

            var itemFulfillment = record.load({
                type: record.Type.ITEM_FULFILLMENT,
                id: itemFulfillmentId,
                isDynamic: false
            });

            var lineCount = itemFulfillment.getLineCount({
                sublistId: 'item'
            });

            var updatedLines = 0;

            for (var i = 0; i < lineCount; i++) {

                var itemId = itemFulfillment.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });

                var description = itemFulfillment.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'description',
                    line: i
                });

                if (!description) {

                    var salesDescription = items[itemId];

                    if (salesDescription) {

                        itemFulfillment.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'description',
                            line: i,
                            value: salesDescription
                        });

                        updatedLines++;

                        log.debug('Description updated', {
                            line: i,
                            itemId: itemId,
                            salesDescription: salesDescription
                        });

                    } else {

                        log.debug('No sales description found', {
                            line: i,
                            itemId: itemId
                        });
                    }

                } else {

                    log.debug('Description already exists', {
                        line: i,
                        itemId: itemId
                    });
                }
            }

            if (updatedLines > 0) {

                var savedId = itemFulfillment.save();

                log.debug('Item Fulfillment saved', {
                    itemFulfillmentId: savedId,
                    updatedLines: updatedLines
                });

            } else {

                log.debug('No changes required', {
                    itemFulfillmentId: itemFulfillmentId
                });
            }

        } catch (e) {

            log.error('Error in map', {
                key: context.key,
                name: e.name,
                message: e.message,
                stack: e.stack
            });

            throw e;
        }
    }

    return {
        getInputData: getInputData,
        map: map
    };
});