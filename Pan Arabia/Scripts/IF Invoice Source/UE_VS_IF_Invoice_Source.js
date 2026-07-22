/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function afterSubmit(context) {
        try {
            log.debug("UE Start", { type: context.type });

            if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
                log.debug("Exit: Not CREATE/EDIT", context.type);
                return;
            }

            var rec = context.newRecord;
            var fulfillmentId = rec.id;
            var soId = rec.getValue('createdfrom');
            log.debug("Processing Fulfillment", { fulfillmentId: fulfillmentId, soId: soId });
            if (!soId) {
                log.debug("Exit: No createdfrom on fulfillment");
                return;
            }

            // collect fulfillment items
            var fulfillItems = [];
            var count = rec.getLineCount({ sublistId: 'item' });
            for (var i = 0; i < count; i++) {
                var item = rec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                var qty = rec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });
                if (item && qty) fulfillItems.push({ id: String(item), qty: parseFloat(qty) });
            }
            log.debug("Fulfillment Items", fulfillItems);
            if (!fulfillItems.length) {
                log.debug("Exit: No items in fulfillment");
                return;
            }

            // search invoices for same SO
            var invSearch = search.create({
                type: "invoice",
                filters: [["createdfrom", "anyof", soId]],
                columns: ["internalid"]
            });

            var matchInvoiceId = null;

            invSearch.run().each(function (res) {
                var invId = res.getValue('internalid');
                log.debug("Invoice Candidate", invId);

                // load invoice
                var inv = record.load({ type: record.Type.INVOICE, id: invId });
                var invItems = {};
                var invCount = inv.getLineCount({ sublistId: 'item' });
                for (var j = 0; j < invCount; j++) {
                    var it = inv.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j });
                    var q = inv.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: j });
                    invItems[it] = (invItems[it] || 0) + parseFloat(q || 0);
                }
                log.debug("Invoice Items", { invoiceId: invId, items: invItems });

                // check match
                var matched = fulfillItems.some(function (f) {
                    return invItems[f.id] && invItems[f.id] >= f.qty;
                });
                log.debug("Match Result", { invoiceId: invId, matched: matched });

                if (!matched) return true; // keep checking

                // only now check if invoice already linked to another fulfillment
                var fSearch = search.create({
                    type: "itemfulfillment",
                    filters: [
                        ["createdfrom", "anyof", soId], "AND",
                        ["custbody_vs_invoice_source", "anyof", invId],
                        "AND", ["internalid", "noneof", fulfillmentId]
                    ]
                });
                var linkedCount = fSearch.runPaged().count;
                log.debug("Linked Fulfillments Found", { invoiceId: invId, linkedCount: linkedCount });

                if (linkedCount > 0) {
                    log.debug("Skip: Invoice already linked elsewhere", invId);
                    return true;
                }

                matchInvoiceId = invId;
                log.debug("Invoice Selected", invId);
                return false; // stop loop
            });

            if (matchInvoiceId) {
                record.submitFields({
                    type: record.Type.ITEM_FULFILLMENT,
                    id: fulfillmentId,
                    values: { custbody_vs_invoice_source: matchInvoiceId },
                    options: { ignoreMandatoryFields: true }
                });
                log.debug("Linked Fulfillment to Invoice", { fulfillmentId: fulfillmentId, invoiceId: matchInvoiceId });
            } else {
                log.debug("No matching invoice found", { fulfillmentId: fulfillmentId });
            }

        } catch (e) {
            log.error("Error in afterSubmit", e);
        }
    }

    return { afterSubmit: afterSubmit };
});
