/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/log'], function (currentRecord, log) {

    function fieldChanged(context) {
        try {
            var rec = currentRecord.get();
            var fieldId = context.fieldId;

            if (fieldId == 'entity') {
                var today = new Date();
                today.setDate(today.getDate() + 7);

                var dd = String(today.getDate()).padStart(2, '0');
                var mm = String(today.getMonth() + 1).padStart(2, '0');
                var yyyy = today.getFullYear();
                var formattedDate = dd + '/' + mm + '/' + yyyy;

                log.debug('formattedDate', formattedDate);

                rec.setText({ fieldId: 'duedate', text: formattedDate });
            }

            if (context.sublistId === 'item' && fieldId === 'quantity') {
                var priceLevelVal = rec.getValue({ fieldId: 'custbody_vs_price_level' });
                if (priceLevelVal !== null && priceLevelVal !== '' && priceLevelVal !== undefined) {

                    rec.setCurrentSublistValue({sublistId: 'item',fieldId: 'price',value: priceLevelVal,ignoreFieldChange: true});
                    log.debug('Price level set by value (quantity change)', priceLevelVal);
                    
                } else {
                    log.debug('Price level not set', 'custbody_vs_price_level is empty on body.');
                }
            }

        } catch (e) {
            console.log('Error in fieldChanged:', e.message);
            try { log.debug('Error in fieldChanged', e); } catch (_) {}
        }
    }

    function postSourcing(context) {
        try {
            if (context.sublistId === 'item' && context.fieldId === 'item') {
                var rec = currentRecord.get();

                var priceLevelVal = rec.getValue({ fieldId: 'custbody_vs_price_level' });
                if (priceLevelVal !== null && priceLevelVal !== '' && priceLevelVal !== undefined) {

                    rec.setCurrentSublistValue({sublistId: 'item',fieldId: 'price',value: priceLevelVal,ignoreFieldChange: true});

                    log.debug('Price level set by value (postSourcing:item)', priceLevelVal);

                } else {
                    log.debug('Price level not set (postSourcing:item)', 'custbody_vs_price_level is empty on body.');
                }
            }
        } catch (e) {
            try { log.debug('Error in postSourcing', e); } catch (_) {}
        }
    }

    return {
        fieldChanged: fieldChanged,
        postSourcing: postSourcing
    };
});
