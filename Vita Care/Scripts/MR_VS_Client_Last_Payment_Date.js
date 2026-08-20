/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 * @fileName MR || Client Last Payment Date
 */

define(['N/search', 'N/record', 'N/log', 'N/format'], function (search, record, log, format) {

    function getInputData() {
        try {

            return search.create({
                type: 'customer',
                filters: [
                    ['isinactive', 'is', 'F'],
                    // "AND",
                    // ["internalid", "anyof", "55096"]
                ],
                columns: [
                    search.createColumn({ name: 'entitynumber', label: 'Number' }),
                    search.createColumn({ name: 'internalid', label: 'Internal ID' })
                ]
            });

        } catch (error) {
            log.error('GET INPUT DATA ERROR', error);
            throw error;
        }
    }

    function map(context) {
        try {

            var result = JSON.parse(context.value);
            var customerId = result.id;

            var customerpaymentSearchObj = search.create({
                type: 'customerpayment',
                settings: [
                    {
                        name: 'consolidationtype',
                        value: 'ACCTTYPE'
                    }
                ],
                filters: [
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['type', 'anyof', 'CustPymt'],
                    'AND',
                    ['customer.internalid', 'anyof', customerId]
                ],
                columns: [
                    search.createColumn({ name: 'tranid', label: 'Document Number' }),
                    search.createColumn({ name: 'trandate', sort: search.Sort.DESC, label: 'Date' }),
                    search.createColumn({ name: 'amount', label: 'Amount' })
                ]
            });

            var newestPaymentDate = null;
            var newestPaymentAmount = null;

            customerpaymentSearchObj.run().each(function (paymentResult) {

                var dateString = paymentResult.getValue({ name: 'trandate' });
                var amount = paymentResult.getValue({ name: 'amount' });

                if (dateString) {
                    newestPaymentDate = format.parse({
                        value: dateString,
                        type: format.Type.DATE
                    });
                }

                if (amount) {
                    newestPaymentAmount = parseFloat(amount);
                } else {
                    newestPaymentAmount = 0;
                }

                return false;
            });

            if (newestPaymentDate) {

                var customerRecord = record.load({
                    type: record.Type.CUSTOMER,
                    id: customerId,
                    isDynamic: false
                });

                customerRecord.setValue({ fieldId: 'custentity_vs_last_payment_date', value: newestPaymentDate });
                customerRecord.setValue({ fieldId: 'custentity_vs_last_payment_amount', value: newestPaymentAmount });

                var savedCustomerId = customerRecord.save();

                log.audit('CUSTOMER UPDATED', {
                    customerId: savedCustomerId,
                    lastPaymentDate: newestPaymentDate,
                    lastPaymentAmount: newestPaymentAmount
                });
            } else {
                log.debug(
                    'NO PAYMENT FOUND',
                    'No customer payment found for Customer ID: ' + customerId
                );
            }

        } catch (error) {
            log.error(
                'MAP ERROR - Customer ID: ' + customerId,
                error
            );
        }
    }

    return {
        getInputData: getInputData,
        map: map
    };
});