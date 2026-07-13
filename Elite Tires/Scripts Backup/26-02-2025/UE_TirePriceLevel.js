/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search'], function (record, search) {

    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
            return;
        }

        try {
            var salesOrder = context.newRecord;
            var customerId = salesOrder.getValue('entity');

            if (!customerId) return;

            var customerData = search.lookupFields({
                type: search.Type.CUSTOMER,
                id: customerId,
                columns: ['custentity_tire_price_level']
            });

            var tirePriceLevel = customerData.custentity_tire_price_level[0] ? customerData.custentity_tire_price_level[0].value : null;

            var lineCount = salesOrder.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < lineCount; i++) {
                var itemId = salesOrder.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });

                var itemData = search.lookupFields({
                    type: search.Type.ITEM,
                    id: itemId,
                    columns: ['class']
                });

                var itemClass = itemData.class[0] ? itemData.class[0].value : null;
                log.debug('itemClass', itemClass);
                log.debug('tirePriceLevel', tirePriceLevel);
                if (itemClass == '1' && tirePriceLevel) { // 1 for tire class
                    salesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'price',
                        line: i,
                        value: tirePriceLevel
                    });
                }
            }
        } catch (error) {
            log.error('Error in the before submit for tire pricelevel', error);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
