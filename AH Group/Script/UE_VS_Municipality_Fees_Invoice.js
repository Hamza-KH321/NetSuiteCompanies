/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record'], function(record) {
    function beforeSubmit(context) {
        if (context.type === context.UserEventType.CREATE) {
            var invoiceRecord = context.newRecord;
            var lineCount = invoiceRecord.getLineCount({ sublistId: 'item' });
            var totalMunicipalityFees = 0;

            for (var i = 0; i < lineCount; i++) {
                // Retrieve the internal ID of the item
                var itemId = invoiceRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });

                log.debug('itemId: ' , itemId);

                // Check if the item ID matches the specified values
                if (itemId == 452 || itemId == 453 || itemId == 454) {
                    // Retrieve quantity and rate for each line
                    var quantity = invoiceRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });
                    var rate = invoiceRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i });

                    // Calculate municipality fees
                    var municipalityFees = (quantity * rate) * 0.025;

                    // Set the municipality fees in the custom field
                    invoiceRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_vs_municipality_fees',
                        line: i,
                        value: municipalityFees
                    });

                    // Add municipality fees to the gross amount
                    var amount = invoiceRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i });
                    var newAmount = (quantity * rate) + municipalityFees;

                    invoiceRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        line: i,
                        value: newAmount
                    });

                    totalMunicipalityFees += municipalityFees;
                }
            }

            totalMunicipalityFees = parseFloat(totalMunicipalityFees.toFixed(2));
            invoiceRecord.setValue({
                fieldId: 'custbody_vs_total_municipality_fees',
                value: totalMunicipalityFees
            });
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
