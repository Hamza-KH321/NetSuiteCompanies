/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/log'], function (currentRecord, log) {

    function fieldChanged(context) {
        try {
            var currentRec = context.currentRecord;
            var fieldId = context.fieldId;

            if (fieldId !== 'custbody_vs_delivery_note_signed_doc') return;

            var recordType = currentRec.type;

            if (recordType === 'invoice') {
                currentRec.setValue({ fieldId: 'custbody_vs_delivery_status_dn', value: 'Delivered' });
                return;
            }

            if (recordType === 'itemreceipt') {
                var lineCount = currentRec.getLineCount({ sublistId: 'item' });
                var validLocations = ['31', '32', '37', '38', '43'];

                for (var i = 0; i < lineCount; i++) {
                    var location = currentRec.getSublistValue({sublistId: 'item',fieldId: 'location',line: i});

                    if (location && validLocations.includes(location.toString())) {
                        currentRec.setValue({ fieldId: 'custbody_vs_delivery_status_dn', value: 'Delivered' });
                        break;
                    }
                }
            }

        } catch (error) {
            log.error('Error in fieldChanged', error);
        }
    }

    return {
        fieldChanged: fieldChanged
    };

});
