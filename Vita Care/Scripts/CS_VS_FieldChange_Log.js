/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS_Log_Field_Changes.js
 */

define(['N/log'], function (log) {

    function fieldChanged(context) {
        try {
            var currentRecord = context.currentRecord;
            var fieldId = context.fieldId;

            if (!fieldId) {
                return;
            }

            var fieldValue = currentRecord.getValue({
                fieldId: fieldId
            });

            log.debug({
                title: 'Field Changed',
                details: 'Field ID: ' + fieldId + ' | New Value: ' + fieldValue
            });

        } catch (error) {
            log.error({
                title: 'Error in fieldChanged',
                details: error
            });
        }
    }

    return {
        fieldChanged: fieldChanged
    };

});