/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Customer Last Payment Details
 */
define(['N/record', 'N/log'], function (record, log) {

    function afterSubmit(context) {
        try {
            // Only relevant on create
            if (context.type !== context.UserEventType.CREATE) {
                return;
            }

            var paymentRecord = context.newRecord;

            var customerId = paymentRecord.getValue({ fieldId: 'customer' });
            var trandate = paymentRecord.getValue({ fieldId: 'trandate' });
            var appliedAmount = paymentRecord.getValue({ fieldId: 'applied' });

            if (!customerId) {
                log.debug('NO CUSTOMER', 'Payment record has no customer, skipping.');
                return;
            }

            if (!trandate) {
                log.debug('NO TRANDATE', 'Payment record has no trandate, skipping.');
                return;
            }

            var customerRecord = record.load({
                type: record.Type.CUSTOMER,
                id: customerId,
                isDynamic: false
            });

            customerRecord.setValue({ fieldId: 'custentity_vs_last_payment_date', value: trandate });
            customerRecord.setValue({ fieldId: 'custentity_vs_last_payment_amount', value: appliedAmount || 0 });

            var savedCustomerId = customerRecord.save();

            log.audit('CUSTOMER UPDATED', {
                customerId: savedCustomerId,
                lastPaymentDate: trandate,
                lastPaymentAmount: appliedAmount
            });

        } catch (error) {
            log.error('AFTER SUBMIT ERROR', error);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});