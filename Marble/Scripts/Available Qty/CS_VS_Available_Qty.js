/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/search', 'N/ui/dialog'], function (search, dialog) {

    function fieldChanged(context) {
        try {
            if (context.sublistId === 'item' && context.fieldId === 'item') {
                
                var currentRecord = context.currentRecord;
                var itemId = currentRecord.getCurrentSublistValue({sublistId: 'item',fieldId: 'item'});
                var transferLocationId = currentRecord.getValue({fieldId: 'transferlocation'});

                if (!itemId || !transferLocationId) {
                    dialog.alert({title: 'Missing Data',message: 'Both Item and Transfer Location must be selected to proceed.'});
                    return;
                }

                var inventoryBalanceSearch = search.create({
                    type: 'inventorybalance',
                    filters: [
                        ['location', 'anyof', transferLocationId],
                        'AND',
                        ['item', 'anyof', itemId]
                    ],
                    columns: [
                        search.createColumn({name: 'available',summary: 'SUM',label: 'Available'})
                    ]
                });

                var searchResults = inventoryBalanceSearch.run().getRange({ start: 0, end: 1 });

                var availableQty = 0;

                if (searchResults.length > 0) {
                    availableQty = parseFloat(searchResults[0].getValue({name: 'available',summary: 'SUM'})) || 0;
                }

                currentRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcolrequestor_location_qty',value: availableQty,ignoreFieldChange: true});
            }
        } catch (e) {
            console.error('Error in fieldChanged:', e.message);
        }
    }

    return {
        fieldChanged: fieldChanged
    };
});
