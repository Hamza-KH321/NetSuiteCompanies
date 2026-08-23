/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API Customer Deposit
 */
define(['N/record', 'N/log'], (record, log) => {

    function onRequest(context) {
        if (context.request.method === 'POST') {
            try {
                let requestBody = JSON.parse(context.request.body);
                let salesOrderId = requestBody.salesOrderId;
                let paymentAmount = requestBody.payment;

                if (!salesOrderId) {
                    throw new Error('Missing required field: salesOrderId');
                }
                if (!paymentAmount) {
                    throw new Error('Missing required field: payment');
                }

                let depositRec = record.create({ type: record.Type.CUSTOMER_DEPOSIT, isDynamic: true });

                let salesOrderRec = record.load({ type: record.Type.SALES_ORDER, id: salesOrderId });

                let customerId = salesOrderRec.getValue('entity');

                depositRec.setValue({ fieldId: 'customer', value: customerId });
                depositRec.setValue({ fieldId: 'salesorder', value: salesOrderId });
                depositRec.setValue({ fieldId: 'custbody_ksa_custmerdposit_tax_code', value: 6 });
                depositRec.setValue({ fieldId: 'payment', value: parseFloat(paymentAmount) });

                let depositId = depositRec.save({ enableSourcing: true, ignoreMandatoryFields: false });

                log.audit('CUSTOMER_DEPOSIT_CREATED', { depositId });

                if (Array.isArray(requestBody.paymentmethod)) {
                    for (let p = 0; p < requestBody.paymentmethod.length; p++) {
                        let pm = requestBody.paymentmethod[p];
                        if (!pm.custrecord_vs_method || !isNumericValue(pm.custrecord_vs_payment_amount) || !pm.custrecord_vs_machine_id) {
                            log.error('PAYMENT_METHOD_VALIDATION_ERROR', pm);
                            continue;
                        }

                        let pmRecord = record.create({ type: 'customrecord_vs_payment_method', isDynamic: true });

                        pmRecord.setValue({ fieldId: 'custrecord_vs_so_reference', value: depositId });
                        pmRecord.setValue({ fieldId: 'custrecord_vs_method', value: pm.custrecord_vs_method });
                        pmRecord.setValue({ fieldId: 'custrecord_vs_payment_amount', value: parseFloat(pm.custrecord_vs_payment_amount) });
                        pmRecord.setValue({ fieldId: 'custrecord_vs_machine_id', value: pm.custrecord_vs_machine_id });

                        let pmId = pmRecord.save({ enableSourcing: true, ignoreMandatoryFields: false });
                        log.audit('PAYMENT_METHOD_CREATED', { internalId: pmId });
                    }
                }

                context.response.write({
                    output: JSON.stringify({
                        success: true,
                        message: 'Customer Deposit created successfully',
                        salesOrderId: salesOrderId,
                        depositId: depositId
                    })
                });

            } catch (e) {
                log.error('Error creating Customer Deposit', e);

                context.response.write({
                    output: JSON.stringify({
                        success: false,
                        error: e.message || e
                    })
                });
            }
        } else {
            context.response.write({
                output: JSON.stringify({
                    success: false,
                    message: 'Only POST method is allowed'
                })
            });
        }
    }

    function isNumericValue(value) {
        return value !== null && value !== '' && isFinite(parseFloat(value));
    }

    return { onRequest };
});
