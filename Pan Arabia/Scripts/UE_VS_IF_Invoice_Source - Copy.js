/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function afterSubmit(context) {
        try {
            if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
                return;
            }

            var newRecord = context.newRecord;
            var itemFulfillmentId = newRecord.id;

            log.debug("Processing Item Fulfillment", itemFulfillmentId);

            var createdFromId = newRecord.getValue({ fieldId: 'createdfrom' });
            if (!createdFromId) {
                log.debug("No createdfrom value found. Skipping...");
                return;
            }

            log.debug("Created From ID", createdFromId);

            // Step 1: Collect item-quantity pairs from Item Fulfillment
            var fulfillmentItems = [];
            var lineCount = newRecord.getLineCount({ sublistId: 'item' });
            for (var i = 0; i < lineCount; i++) {
                var itemId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                var quantity = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });
                
                if (itemId && quantity) {
                    fulfillmentItems.push({ itemId: itemId.toString(), quantity: parseFloat(quantity) });
                }
            }

            log.debug("Item Fulfillment Items", fulfillmentItems);

            if (fulfillmentItems.length === 0) {
                log.debug("No items found in fulfillment. Skipping...");
                return;
            }

            // Step 2: Search Invoices for same Sales Order
            var invoiceSearch = search.create({
                type: "invoice",
                filters: [
                    ["createdfrom", "anyof", createdFromId]
                ],
                columns: [
                    search.createColumn({ name: "internalid", sort: search.Sort.ASC }),
                    search.createColumn({ name: "custbody_vs_invoice_source" })
                ]
            });

            var matchedInvoiceIds = [];

            invoiceSearch.run().each(function (result) {
                var invoiceId = result.getValue({ name: "internalid" });

                // Check if invoice is already linked to another fulfillment (excluding current)
                var fulfillmentSearch = search.create({
                    type: "itemfulfillment",
                    filters: [
                        ["createdfrom", "anyof", createdFromId],
                        "AND",
                        ["custbody_vs_invoice_source", "anyof", invoiceId],
                        "AND",
                        ["internalid", "noneof", itemFulfillmentId]
                    ],
                    columns: ["internalid"]
                });

                var fulfillmentLinked = fulfillmentSearch.runPaged().count > 0;
                if (fulfillmentLinked) {
                    log.debug("Invoice already linked to another fulfillment", invoiceId);
                    return true; // skip
                }

                // Load invoice record
                var invoiceRecord = record.load({
                    type: record.Type.INVOICE,
                    id: invoiceId,
                    isDynamic: false
                });

                var invoiceItems = [];
                var invLineCount = invoiceRecord.getLineCount({ sublistId: 'item' });
                for (var j = 0; j < invLineCount; j++) {
                    var invItemId = invoiceRecord.getSublistValue({sublistId: 'item',fieldId: 'item',line: j});
                    var invQuantity = invoiceRecord.getSublistValue({sublistId: 'item',fieldId: 'quantity',line: j});
                    if (invItemId && invQuantity) {
                        invoiceItems.push({itemId: invItemId.toString(),quantity: parseFloat(invQuantity)});
                    }
                }

                log.debug("Checking Invoice", {invoiceId: invoiceId,invoiceItems: invoiceItems});

                if (matchFulfillmentToInvoice(fulfillmentItems, invoiceItems)) {
                    matchedInvoiceIds.push(invoiceId);
                    log.debug("Matched Invoice Found", invoiceId);
                }

                return true; // continue to check all invoices
            });

            if (!matchedInvoiceIds.length) {
                log.debug("No matching invoice found. Skipping update...");
                return;
            }

            // Step 3: Update the fulfillment with the first matching invoice (or all, if field supports multi)
            // If the field only supports one invoice (single select), just use the first match.
            // If it's a multi-select field, this should be adjusted accordingly.
            var invoiceIdToUse = matchedInvoiceIds[0];

            record.submitFields({
                type: record.Type.ITEM_FULFILLMENT,
                id: itemFulfillmentId,
                values: { custbody_vs_invoice_source: invoiceIdToUse },
                options: { enableSourcing: false, ignoreMandatoryFields: true }
            });

            log.debug("Updated Item Fulfillment", {
                itemFulfillmentId: itemFulfillmentId,
                invoiceId: invoiceIdToUse
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

        // Check if at least one fulfillment line matches invoice item
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
