/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log', 'N/search'], function (record, log, search) {

    function afterSubmit(context) {
        try {
            if (context.type === context.UserEventType.DELETE) return;

            var newRecord = context.newRecord;

            var signedDoc = newRecord.getValue('custrecord_vs_delivery_note_signed_doc');
            if (!signedDoc) {
                log.debug('Skip', 'No signed delivery note document attached');
                return;
            }

            var transactionId = newRecord.getValue('custrecord_vs_transaction_id');
            if (!transactionId) {
                log.debug('Skip', 'No transaction ID linked to this document');
                return;
            }

            var currentRecordId = search.lookupFields({
                type: newRecord.type,
                id: newRecord.id,
                columns: ['internalid']
            }).internalid[0].value;

            log.debug('Current Custom Record ID', currentRecordId);

            var recordObj;
            var type;
            try {
                recordObj = record.load({ type: record.Type.INVOICE, id: transactionId });
                type = record.Type.INVOICE;
                log.debug('Transaction Loaded', 'Loaded as Invoice');
            } catch (e1) {
                try {
                    recordObj = record.load({ type: record.Type.ITEM_RECEIPT, id: transactionId });
                    type = record.Type.ITEM_RECEIPT;
                    log.debug('Transaction Loaded', 'Loaded as Item Receipt');
                } catch (e2) {
                    log.error('Record Load Failed', `Unable to load record ID ${transactionId} as Invoice or Item Receipt`);
                    return;
                }
            }

            recordObj.setValue({ fieldId: 'custbody_vs_delivery_status_dn', value: 'Delivered' });
            recordObj.setValue({fieldId: 'custbody_vs_dn_document_record', value: currentRecordId});

            var updatedId = recordObj.save({enableSourcing: false,ignoreMandatoryFields: true});

            log.audit('Delivery Status Updated', `Record type: ${type}, ID: ${updatedId}`);

        } catch (error) {
            log.error('afterSubmit Error', error);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
