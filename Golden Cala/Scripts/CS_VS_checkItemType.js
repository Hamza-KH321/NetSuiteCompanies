/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/log', 'N/search', 'N/record', 'N/currentRecord'], function(log, search, record, currentRecord) {

    function sublistChanged(context) {
        // Your sublist change logic here
        var currentRecordObj = currentRecord.get();
        var sublistId = context.sublistId;
        var fieldId = context.fieldId;

        var itemID = currentRecordObj.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'item'
        });

        var itemSearchObj = search.create({
            type: "item",
            filters:
            [
               ["internalid","anyof",itemID]
            ],
            columns:
            [
               search.createColumn({name: "type", label: "Type"}),
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "salesdescription", label: "Description"})
            ]
         });

         var itemSearchResult = itemSearchObj.run().getRange({start: 0,end: 1});
         var itemResult = itemSearchResult;
         var itemType = itemResult[0].getValue({name: "type"});

         log.debug('Item is:' , itemID);
         log.debug('Item Type is:' , itemType);

        // Check if the sublist is 'item' and the changed field is 'item'
        if (sublistId === 'recmachcustrecord_vs_posparent' && fieldId === 'custrecord_vs_item') {
            // var itemType = currentRecordObj.getCurrentSublistValue({
            //     sublistId: 'recmachcustrecord_vs_posparent',
            //     fieldId: 'custrecord_vs_item'
            // });

            // Check if the item type is 'Inventory'
            if (itemType === 'InvtPart') { // Fix item Type 
                // Lock the 'inventorydetails' field
                currentRecordObj.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custrecord_vs_lotqty_pos',
                    value: false
                });

                // Inform the user about the lock
                // alert('Inventory Details are now locked for this item.');
            }
        }
    }

    return {
        sublistChanged: sublistChanged
    };

});