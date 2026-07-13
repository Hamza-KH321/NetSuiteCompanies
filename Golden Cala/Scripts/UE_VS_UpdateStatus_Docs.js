/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function (record, log) {

    function afterSubmit(context) {
        try {
            if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
                return;
            }

            var newRecord = context.newRecord;
            var deliveryNote = newRecord.getValue({ fieldId: 'custrecord_vs_so_to_delivery_note' });

            if (!deliveryNote) {
                log.debug("Skipping Record", "No Delivery Note Found");
                return;
            }

            var relatedRecordText = newRecord.getText({ fieldId: 'custrecord_vs_so_to' }) || '';
            log.debug('relatedRecordText', relatedRecordText);
            relatedRecordText = relatedRecordText.trim(); // Remove leading/trailing spaces
            var relatedRecordId = newRecord.getValue({ fieldId: 'custrecord_vs_so_to' });

            if (!relatedRecordText || !relatedRecordId) {
                log.debug("Skipping Record", "No Related Record Found");
                return;
            }

            var recordType = null;

            if (relatedRecordText.indexOf("Sales Order") !== -1) {
                recordType = record.Type.SALES_ORDER;
            } else if (relatedRecordText.indexOf("Transfer Order") !== -1) {
                recordType = record.Type.TRANSFER_ORDER;
            }

            if (!recordType) {
                log.debug("Skipping Record", "Record type not recognized: " + relatedRecordText);
                return;
            }

            try {
                var transactionRecord = record.load({
                    type: recordType,
                    id: relatedRecordId,
                    isDynamic: true
                });

                transactionRecord.setValue({
                    fieldId: 'custbody_vs_delivery_status',
                    value: 6
                });

                transactionRecord.save();
                log.debug("Updated Record", "Successfully set custbody_vs_delivery_status to 6 for " + relatedRecordText);
            } catch (error) {
                log.error("Error Updating Record", error);
            }
        } catch (error) {
            log.error('ERROR!!', error);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
