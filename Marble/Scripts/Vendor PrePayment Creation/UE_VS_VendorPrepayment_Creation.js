/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search'], function(record, search) {

    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.EDIT) {
            return;
        }

        try {
            var currentRecord = context.newRecord;

            var vendor = currentRecord.getValue({ fieldId: 'custrecord_vs_vendor_list' });
            var amount = currentRecord.getValue({ fieldId: 'custrecord_vs_subscription_amount' });
            var status = currentRecord.getValue({ fieldId: 'custrecord_vs_subscription_approval_stat' });
            var subscriptionStatus = currentRecord.getValue({ fieldId: 'custrecord_vs_subscription_status' });

            log.debug('Vendor is: ', vendor);
            log.debug('Amount is: ', amount);
            log.debug('Status is: ', status);
            log.debug('subscriptionStatus is: ', subscriptionStatus);

            if (!vendor || !amount) {
                log.debug('Missing Data', 'Vendor or Amount field is empty');
                return;
            }

            if (status == '2' && subscriptionStatus == 'Active') {
                currentRecord.setValue({fieldId: 'custrecord_vs_vendor_pre_payment_created',value: true});

                var vendorPrepayment = record.create({ type: 'vendorprepayment', isDynamic: true });
    
                vendorPrepayment.setValue({ fieldId: 'entity', value: vendor });
                vendorPrepayment.setValue({ fieldId: 'account', value: 222 });
                vendorPrepayment.setValue({ fieldId: 'payment', value: amount });
                vendorPrepayment.setValue({ fieldId: 'custbody_vs_subscription_source', value: 'Subscription - ' + currentRecord.id });
    
                var vendorPrepaymentId = vendorPrepayment.save();
                log.debug('Vendor Prepayment Created', 'Vendor Prepayment ID: ' + vendorPrepaymentId);

            }   else {
                log.debug('vendorPrepayment not created ', 'Transaction must be approved or check if the Subscription is active or not');
            }


        } catch (e) {
            log.debug('Error in beforeSubmit', e.message);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
