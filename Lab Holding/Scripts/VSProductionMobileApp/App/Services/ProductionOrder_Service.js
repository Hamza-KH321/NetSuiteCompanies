/**
 * @NApiVersion 2.1
 * @Filename ProductionOrder_Service.js
 */

define([
    'N/search',
    'N/record',
    'N/log',
    '../Shared/VSP_Constants.js'
], function (search, record, log, constants) {
    function findOrderIdByNumber(orderNumber) {
        var result = search.create({
            type: constants.PROD_ORDER_RECORD,
            filters: [
                ['idtext', 'is', orderNumber],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        }).run().getRange({ start: 0, end: 1 });

        if (!result || !result.length) return '';
        return result[0].getValue({ name: 'internalid' });
    }

    function getOrderWithLines(orderId) {
        var orderFields = search.lookupFields({
            type: constants.PROD_ORDER_RECORD,
            id: orderId,
            columns: [
                'name',
                constants.FIELD_PRODORD_RECIPE,
                constants.FIELD_PRODORD_QTY,
                constants.FIELD_PRODORD_NOTES
            ]
        });

        var recipe = firstLookup(orderFields[constants.FIELD_PRODORD_RECIPE]);

        return {
            id: orderId,
            orderNumber: orderFields.name || '',
            recipeName: recipe.text || '',
            orderQty: orderFields[constants.FIELD_PRODORD_QTY] || '',
            notes: orderFields[constants.FIELD_PRODORD_NOTES] || '',
            lines: getOrderLines(orderId)
        };
    }

    function getOrderLines(orderId) {
        var lines = [];

        search.create({
            type: constants.PROD_ORDER_ITEM_RECORD,
            filters: [
                [constants.FIELD_PRODORD_ITEM_PARENT, 'anyof', orderId],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: [
                search.createColumn({ name: 'internalid' }),
                search.createColumn({ name: constants.FIELD_PRODORD_ITEM_ITEM }),
                search.createColumn({ name: constants.FIELD_PRODORD_ITEM_UNITS }),
                search.createColumn({ name: constants.FIELD_PRODORD_ITEM_QTY_RECIPE }),
                search.createColumn({ name: constants.FIELD_PRODORD_ITEM_QTY }),
            ]
        }).run().each(function (result) {
            lines.push({
                id: result.getValue({ name: 'internalid' }),
                itemName: result.getText({ name: constants.FIELD_PRODORD_ITEM_ITEM }),
                unitName: result.getText({ name: constants.FIELD_PRODORD_ITEM_UNITS }),
                qtyRecipe: result.getValue({ name: constants.FIELD_PRODORD_ITEM_QTY_RECIPE }) || '0',
                qty: result.getValue({ name: constants.FIELD_PRODORD_ITEM_QTY }) || '0'
            });
            return true;
        });

        return lines;
    }

    function updateLineQuantities(lines) {
        var updated = [];

        (lines || []).forEach(function (line) {
            if (!line || !line.id) return;

            var qty = Number(line.qty);
            if (isNaN(qty) || qty < 0) {
                throw new Error('Invalid quantity for line ' + line.id + '.');
            }

            var values = {};
            values[constants.FIELD_PRODORD_ITEM_QTY] = qty;

            record.submitFields({
                type: constants.PROD_ORDER_ITEM_RECORD,
                id: line.id,
                values: values
            });

            updated.push(line.id);
        });

        return updated;
    }

    function firstLookup(value) {
        if (Array.isArray(value) && value.length) {
            return {
                value: value[0].value || '',
                text: value[0].text || ''
            };
        }

        return {
            value: '',
            text: ''
        };
    }

    return {
        findOrderIdByNumber: findOrderIdByNumber,
        getOrderWithLines: getOrderWithLines,
        updateLineQuantities: updateLineQuantities
    };
});
