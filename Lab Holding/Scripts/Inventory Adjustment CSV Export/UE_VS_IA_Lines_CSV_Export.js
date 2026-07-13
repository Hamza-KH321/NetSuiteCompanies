/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || IA Lines CSV Export
 */
define(['N/ui/serverWidget'], function (serverWidget) {

    var CONFIG = {
        SUBLIST_ID: 'inventory',
        FIELDS: {
            ITEM: 'item',
            NEW_QTY: 'newquantity',
            UNIT_COST: 'unitcost'
        },
        HEADER_FIELDS: {
            LOCATION: 'adjlocation',
            MEMO: 'memo'
        },
        BUTTON_ID: 'custpage_export_csv_btn',
        BUTTON_LABEL: 'Export CSV',
        CLIENT_SCRIPT_FUNCTION: 'downloadInventoryAdjustmentCSV',
        DATA_FIELD_ID: 'custpage_ia_csv_data'
    };

    function beforeLoad(context) {
        try {
            if (context.type !== context.UserEventType.VIEW) {
                return;
            }

            var form = context.form;
            var rec = context.newRecord;

            form.clientScriptModulePath = './CS_VS_IA_Lines_CSV_Export.js';

            var lineCount = rec.getLineCount({ sublistId: CONFIG.SUBLIST_ID });
            var lines = [];

            for (var i = 0; i < lineCount; i++) {
                var itemText = rec.getSublistText({
                    sublistId: CONFIG.SUBLIST_ID,
                    fieldId: CONFIG.FIELDS.ITEM,
                    line: i
                });

                var newQtyValue = rec.getSublistValue({
                    sublistId: CONFIG.SUBLIST_ID,
                    fieldId: CONFIG.FIELDS.NEW_QTY,
                    line: i
                });

                var unit = rec.getSublistText({
                    sublistId: CONFIG.SUBLIST_ID,
                    fieldId: 'units',
                    line: i
                });

                var unitCostValue = rec.getSublistValue({
                    sublistId: CONFIG.SUBLIST_ID,
                    fieldId: CONFIG.FIELDS.UNIT_COST,
                    line: i
                });

                var lineId = rec.getSublistValue({
                    sublistId: CONFIG.SUBLIST_ID,
                    fieldId: 'line',
                    line: i
                });

                var quantityOnHand = rec.getSublistValue({
                    sublistId: CONFIG.SUBLIST_ID,
                    fieldId: 'quantityonhand',
                    line: i
                });

                var adjustQtyBy = rec.getSublistValue({
                    sublistId: CONFIG.SUBLIST_ID,
                    fieldId: 'adjustqtyby',
                    line: i
                });

                lines.push({
                    lineid: parseInt(lineId, 10) || 0,
                    item: itemText,
                    quantityonhand: parseFloat(quantityOnHand) || 0,
                    adjustqtyby: parseFloat(adjustQtyBy) || 0,
                    newquantity: parseFloat(newQtyValue) || 0,
                    unitcost: parseFloat(unitCostValue) || 0,
                    unit: unit
                });
            }

            var locationText = rec.getText({ fieldId: CONFIG.HEADER_FIELDS.LOCATION });
            var memoText = rec.getValue({ fieldId: CONFIG.HEADER_FIELDS.MEMO });

            var payload = {
                location: locationText,
                memo: memoText,
                lines: lines
            };

            var dataField = form.addField({
                id: CONFIG.DATA_FIELD_ID,
                type: serverWidget.FieldType.LONGTEXT,
                label: 'IA CSV Data'
            });
            dataField.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
            dataField.defaultValue = JSON.stringify(payload);

            form.addButton({
                id: CONFIG.BUTTON_ID,
                label: CONFIG.BUTTON_LABEL,
                functionName: CONFIG.CLIENT_SCRIPT_FUNCTION
            });

        } catch (e) {
            log.error('beforeLoad Error', e);
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});