/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record'], function(record) {
    function beforeSubmit(context) {
try {
            var newRecord = context.newRecord;
            var lineCount = newRecord.getLineCount({ sublistId: 'recmachcustrecord_vs_parent' });
            var linesData = [];
    
            for (var i = 0; i < lineCount; i++) {
                var lineObj = {
                    "custrecord_vs_item": newRecord.getSublistValue({
                        sublistId: 'recmachcustrecord_vs_parent',
                        fieldId: 'custrecord_vs_item',
                        line: i
                    }),
                    "custrecord_vs_description": newRecord.getSublistText({
                        sublistId: 'recmachcustrecord_vs_parent',
                        fieldId: 'custrecord_vs_item',
                        line: i
                    }),
                    "custrecord_vs_unit_items": newRecord.getSublistValue({
                        sublistId: 'recmachcustrecord_vs_parent',
                        fieldId: 'custrecord_vs_unit_items',
                        line: i
                    }),
                    "custrecord_vs_quantity": newRecord.getSublistValue({
                        sublistId: 'recmachcustrecord_vs_parent',
                        fieldId: 'custrecord_vs_quantity',
                        line: i
                    }),
                     "custrecord_vs_unit_items_display": newRecord.getSublistValue({
                        sublistId: 'recmachcustrecord_vs_parent',
                        fieldId: 'custrecord_vs_unit_items_display',
                        line: i
                    }),
                    "empty_field_1": "",
                    "empty_field_2": "",
                    "empty_field_3": ""
                };
    
                linesData.push(lineObj);
            }
    
            var jsonData = JSON.stringify(linesData);
    
            log.debug('Data' , jsonData);
    
            newRecord.setValue({
                fieldId: 'custrecord_vs_lines_data',
                value: jsonData
            });
} catch (error) {
    log.error('ERROR' , error);
}
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
