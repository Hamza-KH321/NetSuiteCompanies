/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {
    function afterSubmit(context) {
        try {
            if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
                return;
            }

            var newRecord = context.newRecord;

            var customForm = newRecord.getText('customform');
            var dateNew = newRecord.getValue('custrecord_vs_date_new');
            var customer = newRecord.getValue('custrecord_vs_customer_new');
            var location = newRecord.getValue('custrecord_vs_location_new');
            var totalQty = newRecord.getValue('custrecord_vs_total_qty');

            log.debug('Data', {
                customForm: customForm,
                dateNew: dateNew,
                customer: customer,
                location: location,
                totalQty: totalQty,
            });

            var dateObj = new Date(dateNew);
            var firstDayOfMonth = 
            ('0' + 1).slice(-2) + '/' + 
            ('0' + (dateObj.getMonth() + 1)).slice(-2) + '/' + 
            dateObj.getFullYear();
            
            var lastDayOfMonth = 
            ('0' + new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate()).slice(-2) + '/' + 
            ('0' + (dateObj.getMonth() + 1)).slice(-2) + '/' + 
            dateObj.getFullYear();

            log.debug('Formatted Dates', {
                firstDayOfMonth: firstDayOfMonth,
                lastDayOfMonth: lastDayOfMonth,
            });

            var customrecord_vs_gift_limitSearchObj = search.create({
                type: 'customrecord_vs_gift_limit',
                filters: [
                    ["formulatext: {custrecord_vs_limit_type}","is",customForm],
                    'AND',
                    ['custrecord_vs_customer_list', 'anyof', customer],
                    'AND',
                    ['custrecord_vs_date_limit', 'onorafter', firstDayOfMonth],
                    'AND',
                    ['custrecord_vs_date_limit', 'onorbefore', lastDayOfMonth]
                ],
                columns: [
                    search.createColumn({ name: 'internalid', summary: 'GROUP', label: 'Internal ID' }),
                    search.createColumn({ name: 'custrecord_vs_quantity_limit', summary: 'SUM', label: 'Quantity' })
                ]
            });

            customrecord_vs_gift_limitSearchObj.run().each(function (result) {
                var internalId = result.getValue({ name: 'internalid', summary: 'GROUP' });
                var quantityLimit = parseFloat(result.getValue({ name: 'custrecord_vs_quantity_limit', summary: 'SUM' })) || 0;
                var updatedQuantityLimit = quantityLimit - totalQty;

                log.debug('internalId' , internalId);
                log.debug('quantityLimit' , quantityLimit);
                log.debug('updatedQuantityLimit' , updatedQuantityLimit);

                var giftLimitRecord = record.load({ type: 'customrecord_vs_gift_limit', id: internalId, isDynamic: true });

                giftLimitRecord.setValue({ fieldId: 'custrecord_vs_quantity_limit', value: updatedQuantityLimit });
                giftLimitRecord.save();

                log.debug('Record Updated', { internalId: internalId, updatedQuantityLimit: updatedQuantityLimit });

                return true;
            });
        } catch (error) {
            log.error('Error in afterSubmit', error);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
