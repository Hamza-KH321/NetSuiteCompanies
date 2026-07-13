/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/record', 'N/ui/message'], function (currentRecord, record, message) {
    function pageInit() {
    }

    function callFunction() {
        alert("Creating Sales order")

        var currentRec = currentRecord.get();

        var po = record.load({
            type: currentRec.type,
            id: currentRec.id,
            isDynamic: true
        });

        log.debug({ title: 'PO id', details: po.getValue('entity') });
        log.debug({ title: 'customer id', details: po.getValue('custbody_vs_customer') });

        var customer = po.getValue('custbody_vs_customer');

        // if the customer in the purchase order is empty Error Message
        if (!customer) {
            log.debug({ title: 'Did not enter', details: po.getValue('Hamza') });
            alert("Please enter a customer")
            message.create({
                title: 'Error',
                message: 'Please enter a customer.',
                type: message.Type.ERROR
            }).show();
            return false;
        } else {

            var itemCount = po.getLineCount({
                sublistId: 'item'
            });
            
            log.debug({ title: 'Item count is ', details: itemCount });
            // Create a new sales order record
            var salesOrder = record.create({
                type: record.Type.SALES_ORDER,
                isDynamic: true
            });
            log.debug({ title: 'Sales Order is  ', details: salesOrder });
            salesOrder.setValue({
                fieldId: 'entity',
                value: po.getValue('custbody_vs_customer')
            });
            salesOrder.setValue({
                fieldId: 'trandate',
                value: po.getValue('12/6/2023')
            });

            for (var i = 0; i < itemCount; i++) {
                var itemId = po.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });
                var itemName = po.getSublistText({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });

                log.debug({ title: 'PO Item', details: 'Item ID: ' + itemId + ', Item Name: ' + itemName });


                salesOrder.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: itemId // Internal ID of the item you want to add
                });

                salesOrder.commitLine({
                    sublistId: 'item' // Specify the sublistId as 'item'
                });

            }
            var salesOrderId = salesOrder.save();

            message.create({
                title: 'Success',
                message: 'Sales order has been created. Sales Order ID: ' + salesOrderId,
                type: message.Type.CONFIRMATION
            }).show();

            log.debug({ title: "Sales Order Created", details: "Sales Order ID: " + salesOrderId });

            return true;

        }
    }
    return {
        pageInit: pageInit,
        callFunction: callFunction
    };
});


