/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

define(['N/record', 'N/search', 'N/log', 'N/error'],
    function (record, search, log, error) {

        function beforeSubmit(context) {
            try {
                var newRec = context.newRecord;

                // 1. Get Subsidiary
                var subsidiaryId = newRec.getValue('subsidiary');

                if (!subsidiaryId) {
                    throw error.create({
                        name: 'SUBSIDIARY_REQUIRED',
                        message: 'Subsidiary is required before saving Bill Payment.'
                    });
                }

                // 2. Load Subsidiary search
                var subsidiarySearchObj = search.create({
                    type: "subsidiary",
                    filters: [
                        ["internalid", "anyof", subsidiaryId]
                    ],
                    columns: [
                        search.createColumn({ name: "custrecord_vs_bill_payment_account" })
                    ]
                });

                var result = subsidiarySearchObj.run().getRange({ start: 0, end: 1 });

                if (!result || result.length === 0) {
                    throw error.create({
                        name: 'SUBSIDIARY_NOT_FOUND',
                        message: 'Subsidiary record not found in search.'
                    });
                }

                var row = result[0];
                var billPaymentAccount = row.getValue("custrecord_vs_bill_payment_account");

                log.debug("Subsidiary Account Lookup", {
                    subsidiary: subsidiaryId,
                    billPaymentAccount: billPaymentAccount
                });

                // 3. Set account field only if found
                if (billPaymentAccount) {
                    newRec.setValue({ fieldId: 'account', value: billPaymentAccount });
                }

            } catch (e) {
                log.error('Error in beforeSubmit', e);
                throw e;
            }
        }

        return {
            beforeSubmit: beforeSubmit
        };

    });
