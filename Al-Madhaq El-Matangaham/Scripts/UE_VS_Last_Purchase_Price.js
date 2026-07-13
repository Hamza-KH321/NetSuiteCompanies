/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Last Purchase Price
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function afterSubmit(context) {
        try {

            log.debug('Script Started', 'afterSubmit triggered');

            if (context.type === context.UserEventType.DELETE) {
                return;
            }

            var newRec = context.newRecord;
            var recType = newRec.type;
            var recId = newRec.id;

            log.debug('Record Info', { type: recType, id: recId });

            var lineCount = newRec.getLineCount({ sublistId: 'item' });
            log.debug('Line Count', lineCount);

            if (!lineCount || lineCount === 0) {
                return;
            }

            var itemMap = {};
            var itemIds = [];

            // Collect unique item IDs
            for (var i = 0; i < lineCount; i++) {
                var itemId = newRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });

                if (itemId && !itemMap[itemId]) {
                    itemMap[itemId] = true;
                    itemIds.push(itemId);
                }
            }

            log.debug('Collected Item IDs', itemIds);

            if (itemIds.length === 0) {
                return;
            }

            // Run one search for all items
            var purchaseData = getLastPurchaseData(itemIds);

            log.debug('Search Result Map', purchaseData);

            if (!purchaseData) {
                return;
            }

            // Load record for update
            var rec = record.load({ type: recType, id: recId, isDynamic: false });

            // Loop lines again and set values
            for (var j = 0; j < lineCount; j++) {

                var lineItemId = rec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j });

                if (lineItemId && purchaseData[lineItemId]) {

                    rec.setSublistText({ sublistId: 'item', fieldId: 'custcol_vs_last_purchase_date', line: j, text: purchaseData[lineItemId].trandate });
                    rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_last_purchase_price', line: j, value: purchaseData[lineItemId].rate });

                    log.debug('Line Updated', {
                        line: j,
                        item: lineItemId
                    });
                }
            }

            rec.save({ enableSourcing: false, ignoreMandatoryFields: true });

            log.debug('Record Saved Successfully', recId);

        } catch (e) {
            log.error('Error in afterSubmit', e);
        }
    }

    function getLastPurchaseData(itemIds) {
        try {

            log.debug('Running Single Purchase Order Search', itemIds);

            var resultMap = {};

            var poSearch = search.create({
                type: 'purchaseorder',
                filters: [
                    ['type', 'anyof', 'PurchOrd'],
                    'AND',
                    ['mainline', 'is', 'F'],
                    'AND',
                    ['item', 'anyof', itemIds]
                ],
                columns: [
                    search.createColumn({ name: 'item', summary: 'GROUP' }),
                    search.createColumn({ name: 'trandate', summary: 'MAX' }),
                    search.createColumn({ name: 'rate', summary: 'MAX' })
                ]
            });

            poSearch.run().each(function (result) {

                var itemId = result.getValue({ name: 'item', summary: 'GROUP' });
                var trandate = result.getValue({ name: 'trandate', summary: 'MAX' });
                var rate = result.getValue({ name: 'rate', summary: 'MAX' });

                if (itemId) {
                    resultMap[itemId] = {
                        trandate: trandate,
                        rate: rate
                    };
                }

                return true;
            });

            return resultMap;

        } catch (e) {
            log.error('Error in getLastPurchaseData', e);
            return null;
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});
