/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || JV Totals
 */

define(['N/log'], function (log) {

    function validateLine(context) {
        try {

            if (context.sublistId != 'line') {
                return true;
            }

            var currentRecord = context.currentRecord;

            var totalDebit = parseFloat(currentRecord.getValue({ fieldId: 'custbody_vs_total_debit' })) || 0;
            var totalCredit = parseFloat(currentRecord.getValue({ fieldId: 'custbody_vs_total_credit' })) || 0;

            var debit = parseFloat(currentRecord.getCurrentSublistValue({ sublistId: 'line', fieldId: 'debit' })) || 0;
            var credit = parseFloat(currentRecord.getCurrentSublistValue({ sublistId: 'line', fieldId: 'credit' })) || 0;

            var prevDebit = parseFloat(currentRecord.getCurrentSublistValue({ sublistId: 'line', fieldId: 'custcol_vs_prev_debit' })) || 0;
            var prevCredit = parseFloat(currentRecord.getCurrentSublistValue({ sublistId: 'line', fieldId: 'custcol_vs_prev_credit' })) || 0;

            log.debug('Before Adjustment',
                'debit=' + debit + 
                ' prevDebit=' + prevDebit +
                ' | credit=' + credit + 
                ' prevCredit=' + prevCredit +
                ' | bodyDebit=' + totalDebit + 
                ' bodyCredit=' + totalCredit);

            // Apply delta directly
            if (debit != prevDebit) {

                totalDebit = totalDebit + (debit - prevDebit);

                currentRecord.setValue({
                    fieldId: 'custbody_vs_total_debit',
                    value: totalDebit,
                    ignoreFieldChange: true
                });

                currentRecord.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'custcol_vs_prev_debit',
                    value: debit,
                    ignoreFieldChange: true
                });
            }

            if (credit != prevCredit) {

                totalCredit = totalCredit + (credit - prevCredit);

                currentRecord.setValue({
                    fieldId: 'custbody_vs_total_credit',
                    value: totalCredit,
                    ignoreFieldChange: true
                });

                currentRecord.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'custcol_vs_prev_credit',
                    value: credit,
                    ignoreFieldChange: true
                });
            }

            log.debug('After Adjustment',
                'bodyDebit=' + totalDebit + 
                ' | bodyCredit=' + totalCredit);

            return true;

        } catch (e) {

            log.error({
                title: 'Error in validateLine',
                details: e
            });

            return true;
        }
    }

    return {
        validateLine: validateLine
    };

});
