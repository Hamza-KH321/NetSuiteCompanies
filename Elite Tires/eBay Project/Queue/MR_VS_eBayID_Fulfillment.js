/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/file', 'N/log', 'N/https'], function (search, record, file, log, https) {

    function getInputData() {
        return search.create({
            type: "customrecord_vs_ebay_ids",
            filters: [
                // ["custrecord_ebay_tracking_number", "isempty", ""]
            ],
            columns: [
                search.createColumn({ name: "id" }),
                search.createColumn({ name: "custrecord_netsuite_ebay_transaction" }),
                search.createColumn({ name: "custrecord_ebay_order_id" }),
                search.createColumn({ name: "custrecord_ebay_tracking_number" }),
                search.createColumn({ name: "custrecord_ebay_store_domain" })
            ]
        });
    }

    function map(context) {
        var searchResult = JSON.parse(context.value);
        var ebayRecordId = searchResult.id;
        var ebayOrderId = searchResult.values.custrecord_ebay_order_id;
        var ebayStoreDomainId = searchResult.values.custrecord_ebay_store_domain;
        var salesOrderId = searchResult.values.custrecord_netsuite_ebay_transaction ? searchResult.values.custrecord_netsuite_ebay_transaction.value : null; // Sales Order Internal ID

        log.audit('Processing eBay Order', {
            ebayRecordId: ebayRecordId,
            ebayOrderId: ebayOrderId,
            ebayStoreDomainId: ebayStoreDomainId,
            salesOrderId: salesOrderId
        });

        try {
            var ebayUpdateFields = {}; // Collect updates to submit at once

            var orderData = getOrderData(ebayOrderId);
            if (!orderData) return;

            var ebayToken = getEbayToken(ebayStoreDomainId);
            if (!ebayToken) return;

            var trackingNumber = getTrackingNumber(orderData, ebayToken);
            if (trackingNumber) {
                ebayUpdateFields['custrecord_ebay_tracking_number'] = trackingNumber;
            }

            if (salesOrderId) {
                var fulfillmentId = createItemFulfillment(salesOrderId);
                if (fulfillmentId) {
                    ebayUpdateFields['custrecord_netsuite_ebay_fulfillment'] = fulfillmentId;
                }

                var invoiceId = createInvoice(salesOrderId);
                if (invoiceId) {
                    ebayUpdateFields['custrecord_netsuite_ebay_invoice'] = invoiceId;
                }
            } else {
                log.error("Missing Sales Order ID", "Cannot create Item Fulfillment for eBay ID: " + ebayRecordId);
            }

            // **Submit all updates at once if there are changes**
            if (Object.keys(ebayUpdateFields).length > 0) {
                record.submitFields({
                    type: "customrecord_vs_ebay_ids",
                    id: ebayRecordId,
                    values: ebayUpdateFields
                });
                log.audit("Updated eBay Record", {
                    ebayRecordId: ebayRecordId,
                    updates: ebayUpdateFields
                });
            }

        } catch (error) {
            log.error("Error Processing Order", error);
        }
    }

    /**
     * Fetches eBay order data from the stored JSON file.
     */
    function getOrderData(ebayOrderId) {
        try {
            var fileId = 7089977;
            var fileObj = file.load({ id: fileId });
            var ebayOrdersData = JSON.parse(fileObj.getContents());

            for (var i = 0; i < ebayOrdersData.orders.length; i++) {
                if (ebayOrdersData.orders[i].orderId === ebayOrderId) {
                    return ebayOrdersData.orders[i];
                }
            }
            log.debug("Order Not Found", "Skipping Order ID: " + ebayOrderId);
            return null;
        } catch (error) {
            log.error("Error Fetching Order Data", error);
            return null;
        }
    }

    /**
     * Retrieves eBay API token from the NetSuite custom record.
     */
    function getEbayToken(ebayStoreDomainId) {
        try {
            if (ebayStoreDomainId && ebayStoreDomainId.value) {
                var tokenRecord = record.load({
                    type: "customrecord_vs_ebay_token",
                    id: ebayStoreDomainId.value,
                    isDynamic: false
                });
                return tokenRecord.getValue("custrecord_vs_token");
            }
        } catch (error) {
            log.error("Error Fetching eBay Token", error);
        }
        log.error("Missing eBay Token", "Token not found for store ID: " + ebayStoreDomainId);
        return null;
    }

    /**
     * Retrieves the tracking number from eBay API.
     */
    function getTrackingNumber(orderData, ebayToken) {
        try {
            var fulfillmentLink = orderData.fulfillmentHrefs[0];
            var response = https.get({
                url: fulfillmentLink,
                headers: {
                    'Authorization': 'Bearer ' + ebayToken,
                    "Content-Type": "application/json",
                    "content-Language": "en-US",
                    "Accept": "*/*"
                }
            });

            if (response.code !== 200) {
                log.error("eBay API Error", "Status: " + response.code + " | Response: " + response.body);
                return null;
            }

            var responseBody = JSON.parse(response.body);
            return responseBody.shipmentTrackingNumber || null;
        } catch (error) {
            log.error("Error Fetching Tracking Number", error);
            return null;
        }
    }

    /**
     * Creates an Item Fulfillment from a Sales Order.
     */
    function createItemFulfillment(salesOrderId) {
        try {
            log.audit("Creating Item Fulfillment", "Sales Order ID: " + salesOrderId);

            var itemFulfillment = record.transform({
                fromType: record.Type.SALES_ORDER,
                fromId: salesOrderId,
                toType: record.Type.ITEM_FULFILLMENT,
                isDynamic: true
            });

            itemFulfillment.setValue({ fieldId: 'shipstatus', value: 'C' }); // 'C' = Shipped

            var lineCount = itemFulfillment.getLineCount({ sublistId: 'item' });
            for (var j = 0; j < lineCount; j++) {
                itemFulfillment.selectLine({ sublistId: 'item', line: j });
                itemFulfillment.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: true });
                itemFulfillment.commitLine({ sublistId: 'item' });
            }

            var fulfillmentId = itemFulfillment.save();
            log.audit("Item Fulfillment Created", "Fulfillment ID: " + fulfillmentId);
            return fulfillmentId;
        } catch (error) {
            log.error("Error Creating Item Fulfillment", error);
            return null;
        }
    }

    /**
     * Creates an Invoice from a Sales Order.
     */
    function createInvoice(salesOrderId) {
        try {
            log.audit("Creating Invoice", "Sales Order ID: " + salesOrderId);

            var invoiceRecord = record.transform({
                fromType: record.Type.SALES_ORDER,
                fromId: salesOrderId,
                toType: record.Type.INVOICE,
                isDynamic: true
            });

            var invoiceId = invoiceRecord.save();
            log.audit("Invoice Created", "Invoice ID: " + invoiceId);
            return invoiceId;
        } catch (error) {
            log.error("Error Creating Invoice", error);
            return null;
        }
    }




    return {
        getInputData: getInputData,
        map: map
    };
});