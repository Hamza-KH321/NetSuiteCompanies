/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Auto Apply Amount
 */
define(['N/currentRecord', 'N/log'], function (currentRecord, log) {

    function fieldChanged(context) {
        try {

            if (context.fieldId !== 'custbody_vs_bulk_amount') {
                return;
            }

            var rec = currentRecord.get();

            var bulkAmount = parseFloat(rec.getValue('custbody_vs_bulk_amount')) || 0;
            log.debug({ title: 'Bulk Amount', details: bulkAmount });

            if (bulkAmount <= 0) {
                log.debug({ title: 'Exit', details: 'Bulk amount is zero or less' });
                return;
            }

            var lineCount = rec.getLineCount({ sublistId: 'apply' });
            log.debug({ title: 'Apply Line Count', details: lineCount });

            if (!lineCount || lineCount <= 0) {
                alert('Bulk amount must be lower than or equal to the payment amount.');
                return;
            }

            var lines = [];

            // Collect + reset
            for (var i = 0; i < lineCount; i++) {

                var dueAmt = parseFloat(rec.getSublistValue({sublistId: 'apply',fieldId: 'due',line: i})) || 0;
                var dueDate = rec.getSublistValue({sublistId: 'apply',fieldId: 'duedate',line: i});

                log.debug({
                    title: 'Line Collected',
                    details: 'Line: ' + i + ' | DueAmt: ' + dueAmt + ' | DueDate: ' + dueDate
                });

                if (dueAmt > 0 && dueDate) {
                    lines.push({
                        line: i,
                        origTotal: dueAmt,
                        dueDate: new Date(dueDate)
                    });
                }

                // Reset line
                rec.selectLine({ sublistId: 'apply', line: i });

                rec.setCurrentSublistValue({sublistId: 'apply',fieldId: 'apply',value: false});
                rec.setCurrentSublistValue({sublistId: 'apply',fieldId: 'amount',value: 0});

                rec.commitLine({ sublistId: 'apply' });
            }

            // Sort by due date (oldest first)
            lines.sort(function (a, b) {
                return a.dueDate - b.dueDate;
            });

            log.debug({ title: 'Sorted Lines', details: JSON.stringify(lines) });

            if (!lines.length) {
                alert('Bulk amount must be lower than or equal to the payment amount.');
                return;
            }

            var remaining = bulkAmount;

            // Apply bulk amount
            for (var j = 0; j < lines.length && remaining > 0; j++) {

                var l = lines[j];
                var applyAmount = Math.min(remaining, l.origTotal);

                log.debug({
                    title: 'Applying Amount',
                    details: 'Line: ' + l.line + ' | Apply: ' + applyAmount + ' | Remaining Before: ' + remaining
                });

                rec.selectLine({ sublistId: 'apply', line: l.line });

                rec.setCurrentSublistValue({sublistId: 'apply',fieldId: 'apply',value: true});
                rec.setCurrentSublistValue({sublistId: 'apply',fieldId: 'amount',value: applyAmount});

                rec.commitLine({ sublistId: 'apply' });

                remaining -= applyAmount;

                log.debug({ title: 'Remaining After Apply', details: remaining });
            }

        } catch (e) {
            log.debug({
                title: 'ERROR in fieldChanged',
                details: e.message || e
            });
            alert('Error while applying bulk amount. Check execution log.');
        }
    }

    return {
        fieldChanged: fieldChanged
    };
});
