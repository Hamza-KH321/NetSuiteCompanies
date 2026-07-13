/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/record', 'N/ui/message', 'N/currentRecord', 'N/log'], function (record, message, currentRecord, log) {

    function pageInit(context) {
        if (context.mode === 'create' || context.mode === 'edit') {
            log.debug('Client Script', context.mode);
        }
    }

    function retryOrder() {
        try {
            var currRec = currentRecord.get();
            var recordId = currRec.id;

            if (!recordId) {
                alert("Record ID not found. Please refresh and try again.");
                return;
            }

            // Load the full record to get all fields
            var soQueueRecord = record.load({
                type: 'customrecord_vs_ebay_orders_queue',
                id: recordId
            });

            var orderJson = soQueueRecord.getValue('custrecord_vs_json');

            if (!orderJson) {
                alert("No JSON data found in custrecord_vs_json.");
                return;
            }

            var orderData = JSON.parse(orderJson);
            var creationDate = orderData.creationDate;
            var dateObject = new Date(creationDate);
            var formattedDate = (dateObject.getMonth() + 1) + "/" + dateObject.getDate() + "/" + dateObject.getFullYear();

            // Create a Sales Order
            var salesOrder = record.create({
                type: record.Type.SALES_ORDER,
                isDynamic: true
            });

            salesOrder.setValue({ fieldId: 'entity', value: 31242 });
            salesOrder.setValue({ fieldId: 'memo', value: "eBay Order: " + orderData.orderId });
            salesOrder.setValue({ fieldId: 'custbody_sales_order_status', value: 1 });
            salesOrder.setValue({ fieldId: 'terms', value: 30 });
            salesOrder.setValue({ fieldId: 'custbody_delivery_type', value: 4 });
            salesOrder.setValue({ fieldId: 'location', value: 1 });
            salesOrder.setValue({ fieldId: 'otherrefnum', value: orderData.buyer.buyerRegistrationAddress.fullName });
            salesOrder.setValue({ fieldId: 'custbody_vs_seller_id', value: orderData.sellerId });
            salesOrder.setText({ fieldId: 'custbody_vs_ebay_order_creation_date', text: formattedDate });

            // Set shipping address
            var subrec = salesOrder.getSubrecord({ fieldId: 'shippingaddress' });
            subrec.setValue({ fieldId: 'country', value: orderData.buyer.buyerRegistrationAddress.contactAddress.countryCode });
            subrec.setValue({ fieldId: 'city', value: orderData.buyer.buyerRegistrationAddress.contactAddress.city });
            subrec.setValue({ fieldId: 'state', value: orderData.buyer.buyerRegistrationAddress.contactAddress.stateOrProvince });
            subrec.setValue({ fieldId: 'zip', value: orderData.buyer.buyerRegistrationAddress.contactAddress.postalCode });
            subrec.setValue({ fieldId: 'addr1', value: orderData.buyer.buyerRegistrationAddress.contactAddress.addressLine1 });
            subrec.setValue({ fieldId: 'addrphone', value: orderData.buyer.buyerRegistrationAddress.primaryPhone.phoneNumber });

            // Add Line Items
            orderData.lineItems.forEach(function (item) {
                salesOrder.selectNewLine({ sublistId: 'item' });
                salesOrder.setCurrentSublistText({ sublistId: 'item', fieldId: 'item', text: item.sku });
                salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: item.quantity });
                salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: item.total.value });
                salesOrder.commitLine({ sublistId: 'item' });
            });

            // Save Sales Order
            var salesOrderId = salesOrder.save();
            log.audit("Sales Order Created", { salesOrderId: salesOrderId });

            // Increment attempts count and update queue record
            var currentAttempts = soQueueRecord.getValue('custrecord_vs_no_attempts') || 0;
            currentAttempts++;
            soQueueRecord.setValue({ fieldId: 'custrecord_vs_no_attempts', value: currentAttempts });
            soQueueRecord.setValue({ fieldId: 'custrecord_vs_process_status', value: 'Completed' });
            soQueueRecord.setValue({ fieldId: 'custrecord_vs_order_errors', value: '' });
            soQueueRecord.setValue({ fieldId: 'custrecord_vs_netsuite_so_id', value: salesOrderId }); // Store Sales Order ID
            soQueueRecord.save();

            alert("Retry successful. Sales Order ID: " + salesOrderId);

        } catch (error) {
            log.error("Error in retryOrder", error);
            alert("An error occurred: " + error.message);
        }
    }

    return {
        pageInit: pageInit,
        retryOrder: retryOrder
    };
});
