/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search'], function (record, search) {

    function beforeSubmit(context) {
        if (context.type == context.UserEventType.CREATE) {
            try {
                var poRecord = context.newRecord;
                var totalFulfileldQty = 0;
                var totalOrderedQty = 0;

                var itemCount = poRecord.getLineCount({ sublistId: 'item' });
                log.debug('Line Count is:', itemCount);

                var adjustedFulfilledQtySum = 0;

                for (var i = 0; i < itemCount; i++) {
                    var itemId = poRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                    var lineQuantity = poRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });

                    totalOrderedQty += lineQuantity;

                    var itemfulfillmentSearchObj = search.create({
                        type: "itemfulfillment",
                        filters: [
                            ["item", "anyof", itemId],
                            "AND",
                            ["type", "anyof", "ItemShip"],
                            "AND",
                            ["trandate", "onorafter", "monthsago6"],
                            // "AND",
                            // ["formulanumeric: SUM({quantity})", "greaterthan", 0]
                        ],
                        columns: [
                            search.createColumn({ name: "quantity", summary: "SUM" }),
                            search.createColumn({
                                name: "formulatext",
                                summary: "GROUP",
                                formula: "SUBSTR({trandate}, 4, 2)",
                                label: "Month"
                            })
                        ]
                    });

                    var searchResults = itemfulfillmentSearchObj.run().getRange({ start: 0, end: 1000 });
                    var fulfilledQty = 0;

                    if (searchResults.length > 0) {
                        for (var j = 0; j < searchResults.length; j++) {
                            var quantity = parseFloat(searchResults[j].getValue({ name: "quantity", summary: "SUM" })) || 0;
                            log.debug('Item is ' + itemId, ' quantity is ' + quantity);
                            fulfilledQty += quantity;
                        }

                        log.debug('Item is ' + itemId, ' number of months ' + searchResults.length);

                        var adjustedFulfilledQty = fulfilledQty / searchResults.length;
                        adjustedFulfilledQtySum += adjustedFulfilledQty;
                    }
                }

                totalFulfileldQty = adjustedFulfilledQtySum;

                if (totalFulfileldQty == 0 || totalOrderedQty == 0) {
                    poRecord.setValue({ fieldId: 'custbody_vs_months', value: 0.00 });
                } else {

                    // totalFulfileldQty = totalFulfileldQty / itemCount;
                    totalOrderedQty = totalOrderedQty / itemCount;

                    log.debug('Total Fulfilled Qty is:', totalFulfileldQty);
                    log.debug('Total Ordered Qty is:', totalOrderedQty);

                    var numberOfMonths = (totalOrderedQty / totalFulfileldQty);
                    log.debug('Number Of Months is:', numberOfMonths);

                    poRecord.setValue({ fieldId: 'custbody_vs_months', value: numberOfMonths.toFixed(2) });
                }

            } catch (error) {
                log.error('ERROR!!', error);
            }

        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
