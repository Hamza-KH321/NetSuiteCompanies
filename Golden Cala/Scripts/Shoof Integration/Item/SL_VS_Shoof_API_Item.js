/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API Item
 */
define(['N/record', 'N/log', 'N/search'], (record, log, search) => {

    function onRequest(context) {
        if (context.request.method !== 'POST') {
            context.response.write(JSON.stringify({
                success: false,
                message: 'Only POST method is supported'
            }));
            return;
        }

        try {
            let body = context.request.body;
            let data = JSON.parse(body);

            // Mandatory fields check
            if (!data.itemid || !data.custitem_vs_sku) {
                throw new Error("Missing mandatory fields: itemid and custitem_vs_sku are required.");
            }

            // Check uniqueness of custitem_vs_sku
            let existing = search.create({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                filters: [['custitem_vs_sku', 'is', data.custitem_vs_sku]],
                columns: ['internalid']
            }).run().getRange({ start: 0, end: 1 });

            if (existing && existing.length > 0) {
                throw new Error(`Item with custitem_vs_sku '${data.custitem_vs_sku}' already exists (internalid: ${existing[0].id}).`);
            }

            // Create Lot Numbered Inventory Item
            let itemRec = record.create({ type: record.Type.LOT_NUMBERED_INVENTORY_ITEM, isDynamic: true });

            itemRec.setValue({ fieldId: 'custitem_vs_shoof_item', value: true });
            itemRec.setValue({ fieldId: 'subsidiary', value: 2 });
            itemRec.setValue({ fieldId: 'tracklandedcost', value: true });
            itemRec.setValue({ fieldId: 'itemid', value: data.itemid });
            itemRec.setValue({ fieldId: 'custitem_vs_sku', value: data.custitem_vs_sku });

            if (data.unitstype) {
                itemRec.setText({ fieldId: 'unitstype', text: data.unitstype });
            }
            if (data.class) {
                itemRec.setText({ fieldId: 'class', text: data.class });
            }
            if (data.custitem_vs_product_color) {
                itemRec.setText({ fieldId: 'custitem_vs_product_color', text: data.custitem_vs_product_color });
            }
            if (data.custitem_vs_product_type) {
                itemRec.setText({ fieldId: 'custitem_vs_product_type', text: data.custitem_vs_product_type });
            }
            if (data.custitem39) {
                itemRec.setText({ fieldId: 'custitem39', text: data.custitem39 });
            }

            if (data.taxschedule) {
                let taxVal = (data.taxschedule.toLowerCase() === 'yes') ? 1 : 2;
                itemRec.setValue({ fieldId: 'taxschedule', value: taxVal });
            }

            itemRec.setValue({ fieldId: 'cogsaccount', value: 216 }); // 5102 Cost : COGS : Cost of Goods Sold
            itemRec.setValue({ fieldId: 'assetaccount', value: 248 }); // 11401 Inventory asset : Inventory : Inventories Trade
            itemRec.setValue({ fieldId: 'incomeaccount', value: 337 }); // 401 Sales & Revenues : Sales from main activity

            let itemId = itemRec.save({ enableSourcing: true, ignoreMandatoryFields: false });

            context.response.write(JSON.stringify({
                success: true,
                message: 'Item created successfully',
                internalId: itemId
            }));

        } catch (e) {
            log.error('Error in API Item Creation', e);
            context.response.write(JSON.stringify({ success: false, message: e.message || e.toString() }));
        }
    }

    return { onRequest };
});
