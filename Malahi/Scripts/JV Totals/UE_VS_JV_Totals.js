/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || JV Totals
 */

define(['N/record', 'N/log'], function (record, log) {

    function afterSubmit(context) {

        try {

            log.debug('Script Start', 'After Submit Triggered');

            // Only run on create/edit
            if (context.type !== context.UserEventType.CREATE &&
                context.type !== context.UserEventType.EDIT) {

                log.debug('Exit', 'Not CREATE or EDIT');
                return;
            }

            var rec = record.load({
                type: record.Type.JOURNAL_ENTRY,
                id: context.newRecord.id,
                isDynamic: false
            });

            var lineCount = rec.getLineCount({ sublistId: 'line' });

            log.debug('Line Count', lineCount);

            var totalDebit = 0;
            var totalCredit = 0;

            for (var i = 0; i < lineCount; i++) {

                var debit = rec.getSublistValue({ sublistId: 'line', fieldId: 'debit', line: i }) || 0;
                var credit = rec.getSublistValue({ sublistId: 'line', fieldId: 'credit', line: i }) || 0;

                log.debug('Line ' + i, 'Debit: ' + debit + ' | Credit: ' + credit);

                totalDebit += parseFloat(debit);
                totalCredit += parseFloat(credit);
            }

            log.debug('Totals Calculated',
                'Total Debit: ' + totalDebit +
                ' | Total Credit: ' + totalCredit
            );

            // Update body fields
            rec.setValue({ fieldId: 'custbody_vs_total_debit', value: totalDebit });
            rec.setValue({ fieldId: 'custbody_vs_total_credit', value: totalCredit });

            rec.save({ enableSourcing: false, ignoreMandatoryFields: true });

            log.debug('Success', 'Totals saved successfully');

        } catch (e) {

            log.error('Error in afterSubmit', e.message);
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});
