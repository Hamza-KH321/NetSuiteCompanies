/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Last Purchase Price
 */
define(['N/search', 'N/log', 'N/currentRecord'], function (search, log, currentRecord) {

    function fieldChanged(context) {
        try {

            if (context.sublistId !== 'item' || context.fieldId !== 'item') {
                return;
            }

            var currentRec = context.currentRecord;
            var itemId = currentRec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' });

            log.debug('Selected Item', itemId);

            if (!itemId) {
                return;
            }

            var resultData = getLastPurchaseData(itemId);

            if (!resultData) {
                log.debug('No Purchase Order Data Found', 'Fields will not be populated');
                return;
            }

            currentRec.setCurrentSublistText({ sublistId: 'item', fieldId: 'custcol_vs_last_purchase_date', text: resultData.trandate, ignoreFieldChange: true });
            currentRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_last_purchase_price', value: resultData.rate, ignoreFieldChange: true });

            log.debug('Fields Updated', resultData);

        } catch (e) {
            log.error('Error in fieldChanged', e);
        }
    }

    function getLastPurchaseData(itemId) {
        try {
            log.debug('Loading Purchase Order Search', itemId);

            var purchaseorderSearchObj = search.create({
                type: 'purchaseorder',
                settings: [
                    { name: 'consolidationtype', value: 'ACCTTYPE' }
                ],
                filters: [
                    ['type', 'anyof', 'PurchOrd'],
                    'AND',
                    ['item', 'anyof', itemId]
                ],
                columns: [
                    search.createColumn({ name: 'trandate', summary: 'MAX' }),
                    search.createColumn({ name: 'rate', summary: 'MAX' })
                ]
            });

            var searchResult = purchaseorderSearchObj.run().getRange({ start: 0, end: 1 });

            if (!searchResult || searchResult.length === 0) {
                return null;
            }

            var trandate = searchResult[0].getValue({ name: 'trandate', summary: 'MAX' });
            var rate = searchResult[0].getValue({ name: 'rate', summary: 'MAX' });

            log.debug('Search Result', {
                trandate: trandate,
                rate: rate
            });

            if (!trandate || !rate) {
                return null;
            }

            return {
                trandate: trandate,
                rate: rate
            };

        } catch (e) {
            log.error('Error in getLastPurchaseData', e);
            return null;
        }
    }

    return {
        fieldChanged: fieldChanged
    };

});
