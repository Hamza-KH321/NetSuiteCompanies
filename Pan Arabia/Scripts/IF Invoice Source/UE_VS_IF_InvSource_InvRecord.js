/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/log'], function(record, search, log) {

    function afterSubmit(context) {
        try {
            if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
                return;
            }

            var newRecord = context.newRecord;
            var invoiceId = newRecord.id;
            if (invoiceId == 34428) { return; }

            log.debug("Processing Invoice", invoiceId);

            var salesOrderId = newRecord.getValue({ fieldId: 'createdfrom' });
            if (!salesOrderId) {
                log.debug("No Sales Order found. Skipping...");
                return;
            }

            log.debug("Sales Order ID", salesOrderId);

            // Step 1: Get item IDs and quantities from Invoice
            var invoiceItems = [];
            var invoiceLineCount = newRecord.getLineCount({ sublistId: 'item' });
            for (var i = 0; i < invoiceLineCount; i++) {
                var itemId = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });
                var quantity = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                });
                if (itemId && quantity) {
                    invoiceItems.push({
                        itemId: itemId.toString(),
                        quantity: parseFloat(quantity)
                    });
                }
            }

            log.debug("Invoice Items", invoiceItems);

            if (invoiceItems.length === 0) {
                log.debug("No items found in invoice. Skipping...");
                return;
            }

            // Step 2: Search Fulfillments for same Sales Order
            var itemFulfillmentSearch = search.create({
                type: "itemfulfillment",
                filters: [
                    ["type", "anyof", "ItemShip"],
                    "AND",
                    ["createdfrom", "anyof", salesOrderId]
                ],
                columns: [
                    search.createColumn({ name: "internalid", sort: search.Sort.ASC }),
                    search.createColumn({ name: "custbody_vs_invoice_source" })
                ]
            });

            var matchedFulfillmentIds = [];

            itemFulfillmentSearch.run().each(function(result) {
                var fulfillmentId = result.getValue({ name: "internalid" });
                var linkedInvoice = result.getValue({ name: "custbody_vs_invoice_source" });

                // Skip fulfillments already linked to this invoice
                if (linkedInvoice && linkedInvoice === invoiceId.toString()) {
                    log.debug("Fulfillment already linked to this invoice", fulfillmentId);
                    return true;
                }

                // Skip fulfillments already linked to another invoice
                if (linkedInvoice && linkedInvoice !== invoiceId.toString()) {
                    log.debug("Fulfillment already linked to another invoice", fulfillmentId);
                    return true;
                }

                var fulfillmentRecord = record.load({
                    type: record.Type.ITEM_FULFILLMENT,
                    id: fulfillmentId,
                    isDynamic: false
                });

                var fulfillmentItems = [];
                var lineCount = fulfillmentRecord.getLineCount({ sublistId: 'item' });
                for (var j = 0; j < lineCount; j++) {
                    var itemId = fulfillmentRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: j
                    });
                    var quantity = fulfillmentRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: j
                    });
                    if (itemId && quantity) {
                        fulfillmentItems.push({
                            itemId: itemId.toString(),
                            quantity: parseFloat(quantity)
                        });
                    }
                }

                log.debug("Checking Fulfillment", {
                    fulfillmentId: fulfillmentId,
                    fulfillmentItems: fulfillmentItems
                });

                if (matchFulfillmentToInvoice(fulfillmentItems, invoiceItems)) {
                    matchedFulfillmentIds.push(fulfillmentId);
                    log.debug("Matched Fulfillment Found", fulfillmentId);
                }

                return true; // Keep checking all fulfillments
            });

            if (!matchedFulfillmentIds.length) {
                log.debug("No matching fulfillment found. Skipping update...");
                return;
            }

            // Step 3: Update all matching fulfillments
            matchedFulfillmentIds.forEach(function(fulfillmentId) {
                record.submitFields({
                    type: record.Type.ITEM_FULFILLMENT,
                    id: fulfillmentId,
                    values: { custbody_vs_invoice_source: invoiceId },
                    options: { enableSourcing: false, ignoreMandatoryFields: true }
                });

                log.debug("Updated Item Fulfillment", {
                    itemFulfillmentId: fulfillmentId,
                    invoiceId: invoiceId
                });
            });

        } catch (error) {
            log.error("Error in afterSubmit", error);
        }
    }

    function matchFulfillmentToInvoice(fulfillmentItems, invoiceItems) {
        if (!fulfillmentItems.length || !invoiceItems.length) return false;

        // Build a map of invoice item quantities
        var invoiceMap = {};
        for (var i = 0; i < invoiceItems.length; i++) {
            var inv = invoiceItems[i];
            if (!invoiceMap[inv.itemId]) {
                invoiceMap[inv.itemId] = 0;
            }
            invoiceMap[inv.itemId] += inv.quantity;
        }

        var atLeastOneMatched = false;
        for (var j = 0; j < fulfillmentItems.length; j++) {
            var fulfill = fulfillmentItems[j];
            var invoiceQty = invoiceMap[fulfill.itemId] || 0;

            if (invoiceQty >= fulfill.quantity) {
                atLeastOneMatched = true;
            }
        }

        return atLeastOneMatched;
    }

    return {
        afterSubmit: afterSubmit
    };
});
