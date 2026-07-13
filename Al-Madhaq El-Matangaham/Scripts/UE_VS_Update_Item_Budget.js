/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Update Item Budget
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function afterSubmit(context) {
        try {

            if (context.type != context.UserEventType.CREATE && context.type != context.UserEventType.EDIT) {
                return;
            }

            var rec = context.newRecord;
            var lineCount = rec.getLineCount({ sublistId: 'item' });

            var today = new Date();
            var currentYear = today.getFullYear();
            var currentMonth = today.getMonth() + 1;

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

            for (var i = 0; i < lineCount; i++) {

                try {

                    var itemId = rec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i
                    });

                    var amount = rec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        line: i
                    });

                    log.debug('Processing Line', 'Item: ' + itemId + ' | Amount: ' + amount);

                    if (!itemId || !amount) {
                        continue;
                    }

                    // 🔹 Find budget record
                    var budgetSearch = search.create({
                        type: 'customrecord_vs_item_budget',
                        filters: [
                            ['custrecord_vs_item', 'anyof', itemId],
                            'AND',
                            ['custrecord_vs_year', 'is', currentYear.toString()]
                        ],
                        columns: ['internalid', monthFieldId]
                    });

                    var result = budgetSearch.run().getRange({ start: 0, end: 1 });

                    if (!result || result.length == 0) {
                        log.debug('No Budget Record', itemId);
                        continue;
                    }

                    var budgetId = result[0].getValue('internalid');
                    var currentBudget = result[0].getValue(monthFieldId);

                    log.debug('Budget Before', currentBudget);

                    if (!currentBudget) {
                        continue;
                    }

                    var newBudget = parseFloat(currentBudget) - parseFloat(amount);

                    log.debug('Budget After', newBudget);

                    // 🔹 Update record
                    record.submitFields({
                        type: 'customrecord_vs_item_budget',
                        id: budgetId,
                        values: (function () {
                            var obj = {};
                            obj[monthFieldId] = newBudget;
                            return obj;
                        })()
                    });

                } catch (lineError) {
                    log.error('Line Error', JSON.stringify(lineError));
                }
            }

        } catch (e) {
            log.error('Error in afterSubmit', JSON.stringify(e));
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});