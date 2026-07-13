/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Vendor PrePayment JV
 */
define(['N/record', 'N/log'], function (record, log) {

    function afterSubmit(context) {
        try {
            if (context.type !== context.UserEventType.CREATE &&
                context.type !== context.UserEventType.EDIT) {
                return;
            }

            var vpRecord = context.newRecord;

            var jvCreated = vpRecord.getValue('custbody_vs_jv_created');
            if (jvCreated === true) {
                log.debug('Stopped', 'JV already created');
                return;
            }

            var subsidiary = vpRecord.getValue('subsidiary');
            var vpId = vpRecord.id;
            var entity = vpRecord.getValue('entity');
            var amount = vpRecord.getValue('payment');

            log.debug('Vendor Prepayment Values', {
                subsidiary: subsidiary,
                vpId: vpId,
                entity: entity,
                amount: amount
            });

            /* Load Vendor to get Payables Account */
            var vendorRecord = record.load({ type: record.Type.VENDOR, id: entity });

            var debitAccount = vendorRecord.getValue('payablesaccount');

            log.debug('Vendor Payables Account', debitAccount);

            if (!debitAccount) {
                log.error('Missing Payables Account', 'Vendor has no payables account');
                return;
            }

            var jvRecord = record.create({ type: record.Type.JOURNAL_ENTRY, isDynamic: true });

            jvRecord.setValue('subsidiary', subsidiary);
            jvRecord.setValue('memo', 'Vendor Prepayment Journal Entry');
            jvRecord.setValue('approvalstatus', 2);
            jvRecord.setValue('custbody_vs_vendor_prepayment_referenc', vpId);

            /* Debit Line */
            jvRecord.selectNewLine({ sublistId: 'line' });
            jvRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: debitAccount });
            jvRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'debit', value: amount });
            jvRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'entity', value: entity });
            jvRecord.commitLine({ sublistId: 'line' });

            /* Credit Line */
            jvRecord.selectNewLine({ sublistId: 'line' });
            jvRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: 118 });
            jvRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'credit', value: amount });
            jvRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'entity', value: entity });
            jvRecord.commitLine({ sublistId: 'line' });

            var jvId = jvRecord.save({ enableSourcing: true, ignoreMandatoryFields: false });

            log.debug('JV Created Successfully', jvId);

            record.submitFields({
                type: vpRecord.type,
                id: vpId,
                values: {
                    custbody_vs_jv_reference: jvId,
                    custbody_vs_jv_created: true
                }
            });

        } catch (e) {
            log.error('afterSubmit Error', e);
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});
