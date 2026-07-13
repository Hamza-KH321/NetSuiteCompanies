/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/log', 'N/record', 'N/search', 'N/file', 'N/format', 'N/runtime'], function (log, record, search, file, format, runtime) {

    function getInputData() {
        try {
            // Load the file from File Cabinet
            var fileId = 7089977; // File ID in NetSuite
            var fileObj = file.load({ id: fileId });

            // Read file contents
            var fileContent = fileObj.getContents();
            log.debug("File Content", fileContent);

            // Parse the file content into JSON
            var ebayOrdersData = JSON.parse(fileContent);

            log.debug("getInputData", "Returning eBay orders data from File Cabinet");
            return ebayOrdersData.orders; // Returning orders array for processing in map
        } catch (error) {
            log.error("Error in getInputData", error);
            return [];
        }
    }
    function map(context) {
        try {
            var orderData = JSON.parse(context.value);
            var orderId = orderData.orderId;
            // Get the script parameter value
            var ebayConfigParam = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_ebay_configuration_param' });

            log.debug("Processing Order", { orderId: orderId });

            // Search for existing order in the custom record
            var existingOrderSearch = search.create({
                type: 'customrecord_vs_ebay_orders_queue',
                filters: [
                    ['custrecord_vs_order_id', 'is', orderId]
                ],
                columns: ['id', 'custrecord_vs_no_attempts', 'custrecord_vs_process_status']
            });

            var searchResult = existingOrderSearch.run().getRange({ start: 0, end: 1 });

            if (searchResult.length > 0) {
                var soQueueRecordID = searchResult[0].id;
                var currentAttempts = parseInt(searchResult[0].getValue('custrecord_vs_no_attempts')) || 0;
                var processStatus = searchResult[0].getValue('custrecord_vs_process_status');

                // **Check if process status is "Completed"**
                if (processStatus == "Completed") {
                    log.audit("Skipping Order", { orderId: orderId, reason: "Already Completed" });
                    return; // Exit without processing further
                }

                // **Update attempt count**
                record.submitFields({
                    type: 'customrecord_vs_ebay_orders_queue',
                    id: soQueueRecordID,
                    values: {
                        custrecord_vs_no_attempts: currentAttempts + 1
                    }
                });

                log.debug("Updated Existing Record", { soQueueRecordID: soQueueRecordID, newAttempts: currentAttempts + 1 });

            } else {
                // **Create a new record only if no existing completed order**
                var soQueueRecord = record.create({
                    type: 'customrecord_vs_ebay_orders_queue',
                    isDynamic: true
                });

                soQueueRecord.setValue({ fieldId: 'custrecord_vs_order_id', value: orderId });
                soQueueRecord.setValue({ fieldId: 'custrecord_vs_json', value: JSON.stringify(orderData) });
                soQueueRecord.setValue({ fieldId: 'custrecord_vs_ebay_order_configuration', value: ebayConfigParam});

                var soQueueRecordID = soQueueRecord.save();

                log.debug("Created New Record", { soQueueRecordID: soQueueRecordID, orderId: orderId });
            }

            // Write record ID to Reduce Stage
            context.write({
                key: orderId,
                value: soQueueRecordID
            });

        } catch (error) {
            log.error('ERROR in Map Stage', error);
        }
    }


    function reduce(context) {
        var orderId = context.key;
        var soQueueRecordID = context.values[0]; // Get queue record ID
        var ebayConfigParam = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_ebay_configuration_param' });

        log.debug("Reduce Stage - Processing Queue Record", { orderId: orderId, soQueueRecordID: soQueueRecordID });

        try {
            // Load the queue record
            var soQueueRecord = record.load({
                type: 'customrecord_vs_ebay_orders_queue',
                id: soQueueRecordID
            });

            var orderJson = soQueueRecord.getValue('custrecord_vs_json');
            var orderData = JSON.parse(orderJson);
            var creationDate = orderData.creationDate;

            var dateObject = new Date(creationDate);

            var month = dateObject.getMonth() + 1; // getMonth() returns 0-based index
            var day = dateObject.getDate();
            var year = dateObject.getFullYear();

            // Format the date as M/D/YYYY
            var formattedDate = month + "/" + day + "/" + year;

            log.debug('orderData: ', orderData);
            log.debug('orderData.lineItems: ', orderData.lineItems);
            // Create Sales Order in NetSuite
            var salesOrder = record.create({
                type: record.Type.SALES_ORDER,
                isDynamic: true
            });

            // Set customer
            salesOrder.setValue({ fieldId: 'entity', value: 31242 });

            // Set order details
            salesOrder.setValue({ fieldId: 'memo', value: "eBay Order: " + orderId });
            salesOrder.setValue({ fieldId: 'custbody_sales_order_status', value: 1 });
            salesOrder.setValue({ fieldId: 'terms', value: 30 });
            salesOrder.setValue({ fieldId: 'custbody_delivery_type', value: 4 });
            salesOrder.setValue({ fieldId: 'location', value: 1 });
            salesOrder.setValue({ fieldId: 'otherrefnum', value: orderData.buyer.buyerRegistrationAddress.fullName });
            salesOrder.setValue({ fieldId: 'custbody_vs_seller_id', value: orderData.sellerId });
            salesOrder.setText({ fieldId: 'trandate', text: formattedDate });
            salesOrder.setText({ fieldId: 'custbody_vs_phone_number', text: orderData.buyer.buyerRegistrationAddress.primaryPhone.phoneNumber });

            log.debug('ship daata ', {
                country: orderData.buyer.buyerRegistrationAddress.contactAddress.countryCode,
                city: orderData.buyer.buyerRegistrationAddress.contactAddress.city,
                state: orderData.buyer.buyerRegistrationAddress.contactAddress.stateOrProvince,
                zip: orderData.buyer.buyerRegistrationAddress.contactAddress.postalCode,
                addr1: orderData.buyer.buyerRegistrationAddress.contactAddress.addressLine1,
                addrphone: orderData.buyer.buyerRegistrationAddress.primaryPhone.phoneNumber,
                custrecord_email_address: orderData.buyer.buyerRegistrationAddress.email,
                sellerId: orderData.sellerId,
                formattedDate: formattedDate
            })
            // Create the subrecord.
            var subrec = salesOrder.getSubrecord({
                fieldId: 'shippingaddress'
            });

            // Set values on the subrecord.
            // Set country field first when script uses dynamic mode
            subrec.setValue({ fieldId: 'country', value: orderData.buyer.buyerRegistrationAddress.contactAddress.countryCode });
            subrec.setValue({ fieldId: 'city', value: orderData.buyer.buyerRegistrationAddress.contactAddress.city });
            subrec.setValue({ fieldId: 'state', value: orderData.buyer.buyerRegistrationAddress.contactAddress.stateOrProvince });
            subrec.setValue({ fieldId: 'zip', value: orderData.buyer.buyerRegistrationAddress.contactAddress.postalCode });
            subrec.setValue({ fieldId: 'addr1', value: orderData.buyer.buyerRegistrationAddress.contactAddress.addressLine1 });
            // subrec.setValue({ fieldId: 'addrphone', value: orderData.buyer.buyerRegistrationAddress.primaryPhone.phoneNumber });
            subrec.setValue({ fieldId: 'custrecord_email_address', value: orderData.buyer.buyerRegistrationAddress.email });


            // Default eBay test item ID (Replace with actual ID)
            var defaultEbayTestItemId = 55671;

            // Set item line
            orderData.lineItems.forEach(function (item) {
                var itemId = getItemInternalId(item.lineItemId) || defaultEbayTestItemId; // Fetch item ID or use default

                salesOrder.selectNewLine({ sublistId: 'item' });
                salesOrder.setCurrentSublistText({ sublistId: 'item', fieldId: 'item', text: item.sku });
                salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: item.quantity });
                salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: item.total.value });
                salesOrder.commitLine({ sublistId: 'item' });
            });

            salesOrder.selectNewLine({ sublistId: 'item' });
            salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: 9691 });
            salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 1 });
            salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: 40 });
            salesOrder.commitLine({ sublistId: 'item' });

            salesOrder.selectNewLine({ sublistId: 'item' });
            salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: 24514 });
            salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 1 });
            salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: -40 });
            salesOrder.commitLine({ sublistId: 'item' });

            if (orderData.totalMarketplaceFee.value) {
                salesOrder.selectNewLine({ sublistId: 'item' });
                salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: 55672 });
                salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 1 });
                salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: orderData.totalMarketplaceFee.value });
                salesOrder.commitLine({ sublistId: 'item' });
            }

            // Save Sales Order
            var salesOrderId = salesOrder.save();
            log.audit("Sales Order Created", { orderId: orderId, salesOrderId: salesOrderId });

            // Create a new record in customrecord_vs_ebay_ids
            var ebayIdsRecord = record.create({
                type: 'customrecord_vs_ebay_ids',
                isDynamic: true
            });

            // Set values for the custom record fields
            ebayIdsRecord.setValue({ fieldId: 'custrecord_ebay_store_domain', value: 1 }); // 1 for sandbox 
            ebayIdsRecord.setValue({ fieldId: 'custrecord_netsuite_ebay_transaction', value: salesOrderId }); // Link to Sales Order
            ebayIdsRecord.setValue({ fieldId: 'custrecord_ebay_order_id', value: orderId }); // Set eBay Order ID
            ebayIdsRecord.setValue({ fieldId: 'custrecord_ebay_tracking_number', value: orderData.trackingNumber || '' }); // Set tracking number if available
            ebayIdsRecord.setValue({ fieldId: 'custrecord_ebay_store_domain', value: ebayConfigParam });

            // Save the new eBay IDs record
            var ebayIdsRecordId = ebayIdsRecord.save();
            log.audit("Ebay IDs Record Created", { ebayIdsRecordId: ebayIdsRecordId });

            // Store Sales Order ID in the queue record
            // Store Sales Order ID in the queue record
            record.submitFields({
                type: 'customrecord_vs_ebay_orders_queue',
                id: soQueueRecordID,
                values: {
                    custrecord_vs_process_status: 'Completed',
                    custrecord_vs_netsuite_so_id: salesOrderId // Store the created Sales Order ID
                }
            });


        } catch (error) {
            log.error("ERROR in Reduce", error);

            record.submitFields({
                type: 'customrecord_vs_ebay_orders_queue',
                id: soQueueRecordID,
                values: {
                    custrecord_vs_process_status: 'Error',
                    custrecord_vs_order_errors: error.message || JSON.stringify(error) // Store error message correctly
                }
            });
        }

    }

    function getItemInternalId(lineItemId) {
        try {
            var itemSearch = search.create({
                type: search.Type.ITEM,
                filters: [
                    ['itemid', 'is', lineItemId] // Replace with the actual field ID storing eBay item ID
                ],
                columns: ['internalid']
            });

            var searchResult = itemSearch.run().getRange({ start: 0, end: 1 });

            if (searchResult.length > 0) {
                return searchResult[0].getValue('internalid');
            } else {
                return null;
            }
        } catch (error) {
            log.error("Error in getItemInternalId", { lineItemId: lineItemId, error: error });
            return null;
        }
    }


    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce
    };

});
