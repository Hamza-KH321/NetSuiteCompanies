/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/log'], function(record, log) {

    function afterSubmit(context) {
        try {
            var newRecord = context.newRecord;
            var itemReceiptId = newRecord.id;
            var lineCount = newRecord.getLineCount({ sublistId: 'item' });
            var totalAmountWithTax = 0;

            log.debug('Item Receipt: ', itemReceiptId);
            log.debug('lineCount: ', lineCount);

            // Iterate over each item line
            for (var i = 0; i < lineCount; i++) {
                var itemId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                var quantity = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });
                var rate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i });
                var taxable = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_taxable', line: i });
                var tax = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_tax', line: i });

                log.debug('Taxable or not?', taxable);
                log.debug('quantity', quantity);
                log.debug('rate', rate);
                log.debug('tax is', tax);
                log.debug('______________________________________________');

                // Check if the "Taxable" checkbox is checked
                if (tax == '') {
                    // Calculate total amount with tax
                    totalAmountWithTax += (parseFloat(rate) * parseFloat(quantity)) * 1.15; // Add tax (15%)
                    log.debug('This Line is Taxable');
                } else {
                    // Calculate total amount without tax
                    totalAmountWithTax += (parseFloat(rate) * parseFloat(quantity));
                    log.debug('This Line is Not Taxable');
                }
            }

            log.debug('Total Amount with Tax: ', totalAmountWithTax);

            // Update a custom field on the Item Receipt with the total amount with tax
            record.submitFields({
                type: record.Type.ITEM_RECEIPT,
                id: itemReceiptId,
                values: {
                    custbody_vs_totalitemreceipt: totalAmountWithTax // Replace with your custom field ID
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });

            log.debug('Total Amount with Tax Updated', 'Item Receipt: ' + itemReceiptId + ', Total Amount with Tax: ' + totalAmountWithTax);

        } catch (error) {
            log.error('Error Updating Total Amount with Tax', error.message);
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});
