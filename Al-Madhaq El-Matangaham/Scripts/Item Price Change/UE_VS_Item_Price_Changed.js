/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Item Price Changed
 */
define(['N/search', 'N/log'], function (search, log) {

    function beforeSubmit(context) {
        try {

            log.debug({ title: 'Script Start', details: 'Event Type: ' + context.type });

            if (context.type !== context.UserEventType.CREATE &&
                context.type !== context.UserEventType.EDIT) {
                return;
            }

            var newRecord = context.newRecord;
            var oldRecord = context.oldRecord;

            if (!oldRecord) {
                log.debug({ title: 'No Old Record', details: 'Skipping comparison' });
                return;
            }

            var itemId = newRecord.id;

            log.debug({ title: 'Item ID', details: itemId });

            // ----------------------------
            // OLD VALUES FROM SEARCH
            // ----------------------------

            var oldVendorPrices = {};

            var itemSearchObj = search.create({
                type: "item",
                filters: [
                    ["internalid", "anyof", itemId]
                ],
                columns: [
                    search.createColumn({ name: "internalid" }),
                    search.createColumn({ name: "itemid" }),
                    search.createColumn({ name: "vendorcost" }),
                    search.createColumn({ name: "othervendor" })
                ]
            });

            itemSearchObj.run().each(function (result) {

                var vendorId = result.getValue({ name: "othervendor" });
                var vendorCost = result.getValue({ name: "vendorcost" });

                if (vendorId) {
                    oldVendorPrices[vendorId] = parseFloat(vendorCost) || 0;
                }

                return true;
            });

            log.debug({ title: 'Old Vendor Prices', details: JSON.stringify(oldVendorPrices) });

            // ----------------------------
            // NEW VALUES FROM RECORD
            // ----------------------------

            var lineCount = newRecord.getLineCount({
                sublistId: 'itemvendor'
            });

            log.debug({ title: 'Vendor Line Count', details: lineCount });

            var priceChanged = false;

            for (var i = 0; i < lineCount; i++) {

                var newVendorId = newRecord.getSublistValue({ sublistId: 'itemvendor', fieldId: 'vendor', line: i });
                var newVendorCost = newRecord.getSublistValue({ sublistId: 'itemvendor', fieldId: 'purchaseprice', line: i });

                var parsedNewCost = parseFloat(newVendorCost) || 0;
                var parsedOldCost = parseFloat(oldVendorPrices[newVendorId]) || 0;

                log.debug({
                    title: 'Comparing Vendor',
                    details: 'Vendor: ' + newVendorId +
                        ' | Old: ' + parsedOldCost +
                        ' | New: ' + parsedNewCost
                });

                if (parsedNewCost !== parsedOldCost) {
                    priceChanged = true;
                    break;
                }
            }

            // ----------------------------
            // SET CHECKBOX IF CHANGED
            // ----------------------------

            if (priceChanged) {

                newRecord.setValue({ fieldId: 'custitem_vs_item_price_changed', value: true });

                log.debug({ title: 'Price Changed', details: 'Checkbox set to true' });
            }

        } catch (e) {
            log.error({ title: 'beforeSubmit Error', details: e });
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };

});
