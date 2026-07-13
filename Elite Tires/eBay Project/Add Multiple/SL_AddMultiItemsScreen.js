/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/search'], function (serverWidget, search) {

    function onRequest(context) {
        if (context.request.method === 'GET') {
            var form = serverWidget.createForm({ title: 'Select Multiple Items' });

            var sublist = form.addSublist({id: 'custpage_item_sublist',type: serverWidget.SublistType.INLINEEDITOR,label: 'Select Items'});

            sublist.addField({id: 'custpage_item',type: serverWidget.FieldType.SELECT,label: 'Item',source: 'item'});
            sublist.addField({id: 'custpage_quantity',type: serverWidget.FieldType.INTEGER,label: 'Quantity'});
            
            form.addButton({id: 'custpage_post_items',label: 'Post Items',functionName: 'postSelectedItems()'});

            // Attach the Client Script for handling item selection
            form.clientScriptModulePath = "SuiteScripts/CL_AddMultiItems.js";

            context.response.writePage(form);
        }
    }

    function getAvailableItems() {
        var items = [];
        var itemSearch = search.create({
            type: search.Type.ITEM,
            columns: ['internalid', 'name']
        });

        itemSearch.run().each(function (result) {
            items.push({
                id: result.getValue('internalid'),
                text: result.getValue('name')
            });
            return true;
        });

        return items;
    }

    return {
        onRequest: onRequest
    };
});
