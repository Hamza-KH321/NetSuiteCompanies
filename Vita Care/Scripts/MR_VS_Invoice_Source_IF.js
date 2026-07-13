/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/search', 'N/record', 'N/log'], (search, record, log) => {

    function getInputData() {
        try {
            const itemFulfillmentSearch = search.create({
                type: "itemfulfillment",
                settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "ItemShip"],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["createdfrom", "noneof", "@NONE@"],
                    "AND",
                    ["custbody_vs_invoice_source", "anyof", "@NONE@"],
                    "AND",
                    ["trandate", "within", "thisyear"]
                    // "AND", ["internalid", "anyof", "4677184"]
                ],
                columns: [
                    search.createColumn({ name: "tranid" }),
                    search.createColumn({ name: "internalid" }),
                    search.createColumn({ name: "createdfrom" })
                ]
            });

            let results = [];
            let pagedData = itemFulfillmentSearch.runPaged({ pageSize: 1000 });

            pagedData.pageRanges.forEach(pageRange => {
                let page = pagedData.fetch({ index: pageRange.index });
                page.data.forEach(result => {
                    results.push(JSON.stringify({
                        values: {
                            tranid: { value: result.getValue({ name: "tranid" }) },
                            internalid: { value: result.getValue({ name: "internalid" }) },
                            createdfrom: { value: result.getValue({ name: "createdfrom" }) }
                        }
                    }));
                });
            });

            log.audit("getInputData - Total Results", results.length);
            return results;

        } catch (e) {
            log.error("Error in getInputData", e);
            return [];
        }
    }

    function map(context) {
        try {
            const result = JSON.parse(context.value);
            const ifId = result.values.internalid.value;
            const createdFromId = result.values.createdfrom.value;

            log.debug("Processing IF", { ifId, createdFromId });

            // detect created from record type dynamically
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
            log.error("Error in map", e);
        }
    }

    function reduce(context) {
        log.debug("Reduce stage", context.values);
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

    return { getInputData, map, reduce };

});
