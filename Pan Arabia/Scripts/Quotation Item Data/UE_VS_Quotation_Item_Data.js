/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Quotation Item Data.js
 */
define(['N/search'], function (search) {

    var SUBLIST = 'item';

    var FIELD_MAP = [
        { itemField: 'custitem18', colField: 'custcol_vs_shelf_life' },
        { itemField: 'custitem20', colField: 'custcol_vs_dimensions' },
        { itemField: 'custitem17', colField: 'custcol_vs_packaging' },
        { itemField: 'custitem16', colField: 'custcol_vs_country_of_origin' },
        { itemField: 'manufacturer', colField: 'custcol_vs_custom_manufacturer' }
    ];

    function getItemMeta(itemIds) {
        var meta = {};
        if (!itemIds.length) {
            return meta;
        }

        var columns = [];
        for (var c = 0; c < FIELD_MAP.length; c++) {
            columns.push(FIELD_MAP[c].itemField);
        }

        search.create({
            type: search.Type.ITEM,
            filters: [['internalid', 'anyof', itemIds]],
            columns: columns
        }).run().each(function (result) {
            var values = {};
            for (var i = 0; i < FIELD_MAP.length; i++) {
                var map = FIELD_MAP[i];
                values[map.colField] = result.getText(map.itemField) || result.getValue(map.itemField) || '';
            }
            meta[result.id] = values;
            return true;
        });

        return meta;
    }

    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.CREATE &&
            context.type !== context.UserEventType.EDIT) {
            return;
        }

        var rec = context.newRecord;
        var lineCount = rec.getLineCount({ sublistId: SUBLIST });
        if (!lineCount) {
            return;
        }

        var itemIds = [];
        for (var i = 0; i < lineCount; i++) {
            var itemId = rec.getSublistValue({ sublistId: SUBLIST, fieldId: 'item', line: i });
            if (itemId && itemIds.indexOf(String(itemId)) === -1) {
                itemIds.push(String(itemId));
            }
        }

        var meta = getItemMeta(itemIds);

        for (var line = 0; line < lineCount; line++) {
            var lineItemId = String(rec.getSublistValue({ sublistId: SUBLIST, fieldId: 'item', line: line }));
            var values = meta[lineItemId];
            if (!values) {
                continue;
            }

            for (var f = 0; f < FIELD_MAP.length; f++) {
                var colField = FIELD_MAP[f].colField;
                var current = rec.getSublistValue({ sublistId: SUBLIST, fieldId: colField, line: line }) || '';
                if (current !== values[colField]) {
                    rec.setSublistValue({
                        sublistId: SUBLIST,
                        fieldId: colField,
                        line: line,
                        value: values[colField]
                    });
                }
            }
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});