/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/record'], function(record) {

    function pageInit(context) {
        var currentRecord = context.currentRecord;

        // Set the custentity_vs_record_changed field to false when the page is initialized
        currentRecord.setValue({
            fieldId: 'custentity_vs_record_changed',
            value: false,
            ignoreFieldChange: true // Prevent triggering fieldChanged on initialization
        });

        // Set the custentity_vs_item_pricing_changed field to false when the page is initialized
        currentRecord.setValue({
            fieldId: 'custentity_vs_item_pricing_changed',
            value: false,
            ignoreFieldChange: true // Prevent triggering fieldChanged on initialization
        });
    }

    function fieldChanged(context) {
        var currentRecord = context.currentRecord;
        var sublistId = context.sublistId;
        var fieldId = context.fieldId;

        // Set the custentity_vs_record_changed field to true if any field is changed
        currentRecord.setValue({
            fieldId: 'custentity_vs_record_changed',
            value: true,
            ignoreFieldChange: true // Prevent triggering fieldChanged again
        });

        // Check if the sublist is "itempricing" and the changed field is "item"
        if (sublistId === 'itempricing' && fieldId === 'item') {
            // Set the custentity_vs_item_pricing_changed field to true
            currentRecord.setValue({
                fieldId: 'custentity_vs_item_pricing_changed',
                value: true,
                ignoreFieldChange: true // Prevent triggering fieldChanged again
            });
        }
    }

    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged
    };
});
