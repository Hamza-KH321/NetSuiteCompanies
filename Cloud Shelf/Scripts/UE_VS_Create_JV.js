/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/log'], function(record, search, log) {

    function afterSubmit(context) {
        try {

            var currentRecord = context.newRecord;
            var customer = currentRecord.getValue({ fieldId: 'customer' });
            var amount = currentRecord.getValue({ fieldId: 'payment' });
            var date = currentRecord.getValue({ fieldId: 'trandate' });

            log.debug('Current Record Values', {customer: customer,payment: amount});
            var receivablesAccount = '227'
            log.debug('receivablesAccount', receivablesAccount);
            var customerDepositAcc = 741;
            log.debug('Customer Deposit Account', customerDepositAcc);

            var journalEntry = record.create({type: record.Type.JOURNAL_ENTRY,isDynamic: true});

            journalEntry.setValue({ fieldId: 'subsidiary', value: 2 });
            journalEntry.setValue({ fieldId: 'approvalstatus', value: 2 });
            journalEntry.setValue({ fieldId: 'trandate', value: date });

            // Add first line (Debit)
            journalEntry.selectNewLine({ sublistId: 'line' });
            journalEntry.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: customerDepositAcc });
            journalEntry.setCurrentSublistValue({ sublistId: 'line', fieldId: 'debit', value: amount });
            journalEntry.setCurrentSublistValue({ sublistId: 'line', fieldId: 'entity', value: customer });
            journalEntry.commitLine({ sublistId: 'line' });

            // Add second line (Credit)
            journalEntry.selectNewLine({ sublistId: 'line' });
            journalEntry.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: receivablesAccount });
            journalEntry.setCurrentSublistValue({ sublistId: 'line', fieldId: 'credit', value: amount });
            journalEntry.setCurrentSublistValue({ sublistId: 'line', fieldId: 'entity', value: customer });
            journalEntry.commitLine({ sublistId: 'line' });

            journalEntry.setValue({ fieldId: 'custbody_vs_source', value: currentRecord.id });

            log.debug('Custbody_vs_source Set', {
                source: currentRecord.id
            });

            var journalEntryId = journalEntry.save();
            log.debug('Journal Entry Saved', { journalEntryId: journalEntryId });

        } catch (error) {
            log.error('ERROR!!', error);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
