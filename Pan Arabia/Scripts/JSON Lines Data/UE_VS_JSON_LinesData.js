/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Sample Request Lines Data
 */

define(['N/search', 'N/log'], function(search, log) {

    function beforeSubmit(context) {
        try {

            var newRecord = context.newRecord;

            log.debug('beforeSubmit started', {
                recordType: newRecord.type,
                recordId: newRecord.id
            });

            var lineCount = newRecord.getLineCount({
                sublistId: 'recmachcustrecord_vs_parent'
            });

            log.debug('Line Count', lineCount);

            var linesData = [];

            for (var i = 0; i < lineCount; i++) {

                try {

                    var itemId = newRecord.getSublistValue({
                        sublistId: 'recmachcustrecord_vs_parent',
                        fieldId: 'custrecord_vs_item',
                        line: i
                    });

                    var itemDisplay = newRecord.getSublistValue({
                        sublistId: 'recmachcustrecord_vs_parent',
                        fieldId: 'custrecord_vs_item_display',
                        line: i
                    });

                    log.debug('Line Item Details', {
                        line: i,
                        itemId: itemId,
                        itemDisplay: itemDisplay
                    });

                    var itemDescription = '';

                    if (itemId) {
                        try {

                            var itemData = search.lookupFields({
                                type: search.Type.ITEM,
                                id: itemId,
                                columns: ['itemid', 'displayname']
                            });

                            if (itemData.displayname) {
                                itemDescription = itemData.displayname;
                            } else if (itemData.itemid) {
                                itemDescription = itemData.itemid;
                            }

                        } catch (itemError) {

                            log.error('Error getting item details', {
                                line: i,
                                itemId: itemId,
                                name: itemError.name,
                                message: itemError.message,
                                stack: itemError.stack
                            });
                        }
                    }

                    var lineObj = {
                        "custrecord_vs_item": itemDisplay || "",
                        "custrecord_vs_description": itemDescription,
                        "custrecord_vs_unit_items": newRecord.getSublistValue({
                            sublistId: 'recmachcustrecord_vs_parent',
                            fieldId: 'custrecord_vs_unit_items',
                            line: i
                        }) || "",
                        "custrecord_vs_quantity": newRecord.getSublistValue({
                            sublistId: 'recmachcustrecord_vs_parent',
                            fieldId: 'custrecord_vs_quantity',
                            line: i
                        }) || "",
                        "custrecord_vs_unit_items_display": newRecord.getSublistValue({
                            sublistId: 'recmachcustrecord_vs_parent',
                            fieldId: 'custrecord_vs_unit_items_display',
                            line: i
                        }) || "",
                        "custrecord_vs_invdetails_items": newRecord.getSublistValue({
                            sublistId: 'recmachcustrecord_vs_parent',
                            fieldId: 'custrecord_vs_invdetails_items',
                            line: i
                        }) || "",
                        "custrecord_vs_cost": newRecord.getSublistValue({
                            sublistId: 'recmachcustrecord_vs_parent',
                            fieldId: 'custrecord_vs_cost',
                            line: i
                        }) || "",
                        "empty_field_1": "",
                        "empty_field_2": "",
                        "empty_field_3": ""
                    };

                    linesData.push(lineObj);

                } catch (lineError) {

                    log.error('Error processing line ' + i, {
                        name: lineError.name,
                        message: lineError.message,
                        stack: lineError.stack
                    });
                }
            }

            var jsonData = JSON.stringify(linesData);

            log.debug('Final JSON Data', jsonData);

            newRecord.setValue({
                fieldId: 'custrecord_vs_lines_data',
                value: jsonData
            });

            log.debug('JSON field updated', {
                fieldId: 'custrecord_vs_lines_data'
            });

        } catch (error) {

            log.error('ERROR in beforeSubmit', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});