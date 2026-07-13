/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Item Budget Validation
 */
define(['N/search', 'N/log', 'N/ui/dialog'], function (search, log, dialog) {

    function fieldChanged(context) {
        try {

            var rec = context.currentRecord;

            if (context.sublistId != 'item' || context.fieldId != 'item') {
                return;
            }

            var itemId = rec.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'item'
            });

            if (!itemId) {
                return;
            }

            var today = new Date();
            var currentYear = today.getFullYear();
            var currentMonth = today.getMonth() + 1;

            log.debug('fieldChanged', 'Item: ' + itemId + ' | Year: ' + currentYear + ' | Month: ' + currentMonth);

            var monthFieldMap = {
                1: 'custrecord_vs_january_amount',
                2: 'custrecord_vs_february_amount',
                3: 'custrecord_vs_march_amount',
                4: 'custrecord_vs_april_amount',
                5: 'custrecord_vs_may_amount',
                6: 'custrecord_vs_june_amount',
                7: 'custrecord_vs_july_amount',
                8: 'custrecord_vs_august_amount',
                9: 'custrecord_vs_september_amount',
                10: 'custrecord_vs_october_amount',
                11: 'custrecord_vs_november_amount',
                12: 'custrecord_vs_december_amount'
            };

            var monthFieldId = monthFieldMap[currentMonth];

            // 🔹 SAFE PLACE to run search
            var budgetSearch = search.create({
                type: 'customrecord_vs_item_budget',
                filters: [
                    ['custrecord_vs_item', 'anyof', itemId],
                    'AND',
                    ['custrecord_vs_year', 'is', currentYear.toString()]
                ],
                columns: [monthFieldId]
            });

            var result = budgetSearch.run().getRange({
                start: 0,
                end: 1
            });

            log.debug('Search Result', JSON.stringify(result));

            if (!result || result.length == 0) {
                return;
            }

            var budgetValue = result[0].getValue(monthFieldId);

            log.debug('Budget Value', budgetValue);

            if (!budgetValue) {
                return;
            }

            rec.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_vs_item_budget',
                value: parseFloat(budgetValue)
            });

        } catch (e) {
            log.error('Error in fieldChanged', JSON.stringify(e));
        }
    }

    function validateLine(context) {
        try {

            var rec = context.currentRecord;

            if (context.sublistId != 'item') {
                return true;
            }

            var amount = rec.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'amount'
            });

            var budgetValue = rec.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_vs_item_budget'
            });

            log.debug('validateLine', 'Amount: ' + amount + ' | Budget: ' + budgetValue);

            if (budgetValue && parseFloat(amount) > parseFloat(budgetValue)) {

                dialog.alert({
                    title: 'Budget Exceeded',
                    message: 'You are exceeding the budget for this item in this month.'
                });

                log.debug('Validation', 'Exceeded');
            }

            return true;

        } catch (e) {
            log.error('Error in validateLine', JSON.stringify(e));
            return true;
        }
    }

    return {
        fieldChanged: fieldChanged,
        validateLine: validateLine
    };

});