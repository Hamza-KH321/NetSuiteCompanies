/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/log'], (record, search, log) => {

    function afterSubmit(context) {
        try {
            if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
                return;
            }

            const newRec = context.newRecord;
            const ifId = newRec.id;
            const createdFromId = newRec.getValue('createdfrom');

            if (!createdFromId) {
                log.debug("No created from", { ifId });
                return;
            }

            log.debug("Processing IF", { ifId, createdFromId });

            // Detect created from record type dynamically
            const createdFromType = search.lookupFields({
                type: 'transaction',
                id: createdFromId,
                columns: ['type']
            }).type[0].value;

            if (createdFromType === 'SalesOrd') {
                handleSalesOrder(createdFromId, ifId);
            } else if (createdFromType === 'RtnAuth') {
                handleRMA(createdFromId, ifId);
            } else if (createdFromType === 'VendAuth') {
                handleVRA(createdFromId, ifId);
            }

        } catch (e) {
            log.error("Error in afterSubmit", e);
        }
    }

    function handleSalesOrder(soId, ifId) {
        const invSearch = search.create({
            type: "invoice",
            filters: [["createdfrom", "anyof", soId]],
            columns: ["internalid"]
        });

        invSearch.run().each(inv => {
            const invId = inv.getValue("internalid");
            if (compareItemsQuantities(record.Type.INVOICE, invId, ifId)) {
                updateIF(ifId, invId);
                return false; // stop after first match
            }
            return true;
        });
    }

    function handleRMA(rmaId, ifId) {
        const cmSearch = search.create({
            type: "creditmemo",
            filters: [["createdfrom", "anyof", rmaId]],
            columns: ["internalid"]
        });

        cmSearch.run().each(cm => {
            const cmId = cm.getValue("internalid");
            if (compareItemsQuantities(record.Type.CREDIT_MEMO, cmId, ifId)) {
                updateIF(ifId, cmId);
                return false;
            }
            return true;
        });
    }

    function handleVRA(vraId, ifId) {
        const vcSearch = search.create({
            type: "vendorcredit",
            filters: [["createdfrom", "anyof", vraId]],
            columns: ["internalid"]
        });

        vcSearch.run().each(vc => {
            const vcId = vc.getValue("internalid");
            if (compareItemsQuantities(record.Type.VENDOR_CREDIT, vcId, ifId)) {
                updateIF(ifId, vcId);
                return false;
            }
            return true;
        });
    }

    function compareItemsQuantities(targetType, targetId, ifId) {
        try {
            const targetRec = record.load({ type: targetType, id: targetId });
            const ifRec = record.load({ type: record.Type.ITEM_FULFILLMENT, id: ifId });

            const targetItems = getItems(targetRec, "item");
            const ifItems = getItems(ifRec, "item");

            if (targetItems.length !== ifItems.length) return false;

            for (let i = 0; i < ifItems.length; i++) {
                const ifItem = ifItems[i];
                const match = targetItems.find(t => t.item === ifItem.item && t.qty === ifItem.qty);
                if (!match) return false;
            }

            return true; // all matched
        } catch (e) {
            log.error("Error in compareItemsQuantities", e);
            return false;
        }
    }

    function getItems(rec, sublistId) {
        const items = [];
        const lineCount = rec.getLineCount({ sublistId });
        for (let i = 0; i < lineCount; i++) {
            const item = rec.getSublistValue({ sublistId, fieldId: "item", line: i });
            const qty = rec.getSublistValue({ sublistId, fieldId: "quantity", line: i });
            items.push({ item, qty });
        }
        return items;
    }

    function updateIF(ifId, sourceId) {
        try {
            record.submitFields({
                type: record.Type.ITEM_FULFILLMENT,
                id: ifId,
                values: {
                    custbody_vs_invoice_source: sourceId
                }
            });
            log.audit("Updated IF", { ifId, sourceId });
        } catch (e) {
            log.error("Error updating IF", e);
        }
    }

    return { afterSubmit };

});
