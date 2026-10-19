/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Check All Items
 */
define(['N/currentRecord', 'N/ui/message'], function(currentRecord, message) {

    function pageInit(context) {
        console.log('Client Script initialized.');
    }

    function checkAllItems() {
        try {
            var rec = currentRecord.get();
            var lineCount = rec.getLineCount({
                sublistId: 'item'
            });

            console.log('Total item lines: ' + lineCount);

            var checkedCount = 0;
            var skippedCount = 0;

            for (var i = 0; i < lineCount; i++) {
                var quantity = rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                });

                var quantityReceived = rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantityreceived',
                    line: i
                });

                console.log('Line ' + i + ' - Quantity: ' + quantity +
                    ', Quantity Received: ' + quantityReceived);

                if (Number(quantityReceived || 0) == Number(quantity || 0)) {
                    console.log('Skipping line ' + i +
                        ': Quantity received equals quantity.');
                    skippedCount++;
                    continue;
                }

                rec.selectLine({
                    sublistId: 'item',
                    line: i
                });

                rec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_vs_rma',
                    value: true,
                    ignoreFieldChange: true
                });

                rec.commitLine({
                    sublistId: 'item'
                });

                checkedCount++;
            }

            message.create({
                title: 'Success',
                message: 'Items checked: ' + checkedCount +
                    '. Lines skipped because quantity received equals quantity: ' +
                    skippedCount + '.',
                type: message.Type.CONFIRMATION
            }).show();

            console.log('Check All Items completed. Checked: ' +
                checkedCount + ', Skipped: ' + skippedCount);

        } catch (e) {
            console.log('Error in checkAllItems: ' + e.name + ' - ' + e.message);

            message.create({
                title: 'Error',
                message: 'Unable to check all items. Error: ' + e.message,
                type: message.Type.ERROR
            }).show();
        }
    }

    return {
        pageInit: pageInit,
        checkAllItems: checkAllItems
    };
});