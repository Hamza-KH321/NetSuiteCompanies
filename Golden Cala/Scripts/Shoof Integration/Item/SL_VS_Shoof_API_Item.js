/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API Item
 */
define(['N/record', 'N/log', 'N/search'], function (record, log, search) {

    function onRequest(context) {
        try {
            if (context.request.method != 'POST') {
                context.response.write(JSON.stringify({
                    success: false,
                    message: 'Only POST method is supported'
                }));
                return;
            }

            var body = context.request.body;
            var data = JSON.parse(body);

            log.debug('Request Body', data);

            // Mandatory fields check
            if (!data.itemid || !data.custitem_vs_sku || !data.itemtype) {
                throw new Error('Missing mandatory fields: itemid, custitem_vs_sku and itemtype are required.');
            }

            // Validate item type
            var itemType = String(data.itemtype).toLowerCase();

            if (itemType != 'inventoryitem' && itemType != 'lot_numbered_inventory_item') {
                throw new Error('Invalid itemtype. Allowed values are inventoryitem or LOT_NUMBERED_INVENTORY_ITEM.');
            }

            var recordType;

            if (itemType == 'inventoryitem') {
                recordType = record.Type.INVENTORY_ITEM;
            } else {
                recordType = record.Type.LOT_NUMBERED_INVENTORY_ITEM;
            }

            log.debug('Item Type', {
                itemtype: data.itemtype,
                recordType: recordType
            });

            // Check uniqueness of custitem_vs_sku
            var existing = search.create({
                type: recordType,
                filters: [
                    ['custitem_vs_sku', 'is', data.custitem_vs_sku]
                ],
                columns: [
                    'internalid'
                ]
            }).run().getRange({
                start: 0,
                end: 1
            });

            if (existing && existing.length > 0) {
                throw new Error(
                    "Item with custitem_vs_sku '" +
                    data.custitem_vs_sku +
                    "' already exists (internalid: " +
                    existing[0].id +
                    ")."
                );
            }

            // Create Item
            var itemRec = record.create({
                type: recordType,
                isDynamic: true
            });

            log.debug('Item Record Created', recordType);

            itemRec.setValue({
                fieldId: 'custitem_vs_shoof_item',
                value: true
            });

            itemRec.setValue({
                fieldId: 'subsidiary',
                value: 2
            });

            itemRec.setValue({
                fieldId: 'tracklandedcost',
                value: true
            });

            itemRec.setValue({
                fieldId: 'itemid',
                value: data.itemid
            });

            itemRec.setValue({
                fieldId: 'custitem_vs_sku',
                value: data.custitem_vs_sku
            });

            if (data.unitstype) {
                itemRec.setText({
                    fieldId: 'unitstype',
                    text: data.unitstype
                });
            }

            if (data.class) {
                itemRec.setText({
                    fieldId: 'class',
                    text: data.class
                });
            }

            if (data.custitem_vs_product_color) {
                itemRec.setText({
                    fieldId: 'custitem_vs_product_color',
                    text: data.custitem_vs_product_color
                });
            }

            if (data.custitem_vs_product_type) {
                itemRec.setText({
                    fieldId: 'custitem_vs_product_type',
                    text: data.custitem_vs_product_type
                });
            }

            if (data.custitem39) {
                itemRec.setText({
                    fieldId: 'custitem39',
                    text: data.custitem39
                });
            }

            if (data.taxschedule) {
                var taxVal = String(data.taxschedule).toLowerCase() == 'yes' ? 1 : 2;

                itemRec.setValue({
                    fieldId: 'taxschedule',
                    value: taxVal
                });
            }

            itemRec.setValue({
                fieldId: 'cogsaccount',
                value: 216
            });

            itemRec.setValue({
                fieldId: 'assetaccount',
                value: 248
            });

            itemRec.setValue({
                fieldId: 'incomeaccount',
                value: 337
            });

            var itemId = itemRec.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            log.audit('Item Created Successfully', {
                internalId: itemId,
                itemType: recordType,
                itemid: data.itemid,
                sku: data.custitem_vs_sku
            });

            context.response.write(JSON.stringify({
                success: true,
                message: 'Item created successfully',
                internalId: itemId,
                itemType: recordType
            }));

        } catch (e) {
            log.error('Error in API Item Creation', {
                name: e.name,
                message: e.message,
                stack: e.stack
            });

            context.response.write(JSON.stringify({
                success: false,
                message: e.message || e.toString()
            }));
        }
    }

    return {
        onRequest: onRequest
    };
});
