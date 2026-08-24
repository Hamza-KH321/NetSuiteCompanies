/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API Transfer Order
 */
define(['N/record', 'N/search', 'N/log'], (record, search, log) => {

    function onRequest(context) {
        if (context.request.method !== 'POST') {
            context.response.write(JSON.stringify({
                success: false,
                code: 'METHOD_NOT_ALLOWED',
                message: 'Use POST with JSON body.'
            }));
            return;
        }

        try {
            let body = JSON.parse(context.request.body);
            log.audit('Incoming Request', body);

            if (!body.fromLocation || !body.toLocation) {
                throw new Error('Both fromLocation and toLocation are required.');
            }

            let toRec = record.create({
                type: record.Type.TRANSFER_ORDER,
                isDynamic: true
            });

            toRec.setValue({ fieldId: 'customform', value: 174 }); // Shoof Transfer Order
            toRec.setValue({ fieldId: 'subsidiary', value: 2 });
            toRec.setValue({ fieldId: 'orderstatus', value: 'B' });
            toRec.setValue({ fieldId: 'custbody_vs_shoof_transaction', value: true });
            toRec.setValue({ fieldId: 'location', value: body.fromLocation });   // From Location
            toRec.setValue({ fieldId: 'transferlocation', value: body.toLocation }); // To Location

            if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
                throw new Error('No lines provided.');
            }

            body.lines.forEach(line => {
                let itemId = findItemBySKU(line.sku);
                if (!itemId) {
                    throw new Error('Item not found for SKU: ' + line.sku);
                }

                if (!line.quantity || parseFloat(line.quantity) <= 0) {
                    throw new Error('Quantity must be greater than 0 for SKU: ' + line.sku);
                }

                toRec.selectNewLine({ sublistId: 'item' });
                toRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemId });
                toRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: line.quantity });
                toRec.commitLine({ sublistId: 'item' });
            });

            let toId = toRec.save({ enableSourcing: true, ignoreMandatoryFields: false });

            context.response.write(JSON.stringify({
                success: true,
                message: 'Transfer Order created successfully.',
                id: toId
            }));

        } catch (e) {
            log.error('ERROR', e);
            context.response.write(JSON.stringify({
                success: false,
                message: e.message || e.toString()
            }));
        }
    }

    function findItemBySKU(sku) {
        let itemSearch = search.create({
            type: search.Type.ITEM,
            filters: [['custitem_vs_sku', 'is', sku]],
            columns: ['internalid']
        }).run().getRange({ start: 0, end: 1 });

        if (itemSearch && itemSearch.length > 0) {
            return itemSearch[0].getValue('internalid');
        }
        return null;
    }

    return { onRequest };
});
