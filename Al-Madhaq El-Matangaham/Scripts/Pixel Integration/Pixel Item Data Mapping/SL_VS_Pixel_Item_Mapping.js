/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function onRequest(context) {
        try {
            if (context.request.method !== 'POST') {
                context.response.write(JSON.stringify({
                    status: 'error',
                    message: 'Only POST method is allowed.'
                }));
                return;
            }

            // Parse incoming JSON
            var body = JSON.parse(context.request.body);
            log.debug('Incoming JSON', body);

            var itemName = body.itemid;
            var upcCode = body.upccode;
            var assetAccount = body.assetaccount;
            var incomeAccount = body.incomeaccount;

            // Validate required fields
            if (!itemName || !upcCode || !assetAccount || !incomeAccount) {
                context.response.write(JSON.stringify({
                    status: 'error',
                    message: 'Missing required fields: itemid, upccode, assetaccount, incomeaccount'
                }));
                return;
            }

            var existingItem = search.create({
                type: search.Type.ITEM,
                filters: [
                    ['upccode', 'is', upcCode]
                ],
                columns: ['internalid']
            }).run().getRange({ start: 0, end: 1 });

            if (existingItem.length > 0) {
                context.response.write(JSON.stringify({
                    status: 'error',
                    message: 'Item already exists with this UPC code.',
                    existing_item_internalid: existingItem[0].getValue('internalid')
                }));
                return;
            }

            var itemRec = record.create({
                type: record.Type.INVENTORY_ITEM,
                isDynamic: true
            });

            // Required fields
            itemRec.setValue({ fieldId: 'subsidiary', value: 2 });
            itemRec.setValue({ fieldId: 'taxschedule', value: 1 });
            itemRec.setValue({ fieldId: 'cogsaccount', value: 132 });

            // Provided fields
            itemRec.setValue({ fieldId: 'itemid', value: itemName });
            itemRec.setValue({ fieldId: 'upccode', value: upcCode });
            itemRec.setValue({ fieldId: 'incomeaccount', value: incomeAccount });
            itemRec.setValue({ fieldId: 'assetaccount', value: assetAccount });

            // Save new item
            var newId = itemRec.save();
            log.debug("Item Created", newId);

            context.response.write(JSON.stringify({
                status: 'success',
                message: 'Inventory item created successfully.',
                internalid: newId
            }));

        } catch (e) {
            log.error('Error', e);

            context.response.write(JSON.stringify({
                status: 'error',
                message: e.message
            }));
        }
    }

    return { onRequest: onRequest };
});
