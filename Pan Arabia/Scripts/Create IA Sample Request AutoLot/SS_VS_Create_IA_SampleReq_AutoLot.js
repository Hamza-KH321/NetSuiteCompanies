/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/runtime', 'N/log', 'N/email'], function (record, search, runtime, log, email) {

    function execute(scriptContext) {
        try {
            var scriptObj = runtime.getCurrentScript();
            var rectype = scriptObj.getParameter({ name: 'custscript_vs_type' });
            var recid = scriptObj.getParameter({ name: 'custscript_vs_id' });

            var newRecord = record.load({ type: rectype, id: recid });
            var internalID = newRecord.getValue({ fieldId: "id" });
            var location = newRecord.getValue({ fieldId: "custrecord_vs_warehouse" });
            var headerNotes = newRecord.getValue({ fieldId: "custrecord_vs_memo" });
            var IACreated = newRecord.getValue({ fieldId: "custrecord_vs_iacreated" });
            var approvalStatus = newRecord.getValue({ fieldId: "custrecord_vs_srapprovalstatus" });
            var brand = newRecord.getSublistValue({ sublistId: "recmachcustrecord_vs_parent", fieldId: "custrecord_vs_brand_item", line: 0 });

            if (approvalStatus == 2 && !IACreated) {

                var inventoryAdjustment = record.create({ type: record.Type.INVENTORY_ADJUSTMENT, isDynamic: true });

                inventoryAdjustment.setValue({ fieldId: "subsidiary", value: 2 });
                inventoryAdjustment.setValue({ fieldId: "custbody_vs_source", value: 'Sample Request - ' + internalID });
                inventoryAdjustment.setValue({ fieldId: "memo", value: headerNotes });
                inventoryAdjustment.setValue({ fieldId: "account", value: '528' });
                inventoryAdjustment.setValue({ fieldId: "adjlocation", value: location });
                inventoryAdjustment.setValue({ fieldId: "class", value: brand });

                var itemCount = newRecord.getLineCount({ sublistId: "recmachcustrecord_vs_parent" });
                var itemIds = [];
                var lotUsageByItem = {};

                for (var i = 0; i < itemCount; i++) {
                    var itemId = newRecord.getSublistValue({ sublistId: "recmachcustrecord_vs_parent", fieldId: "custrecord_vs_item", line: i });
                    itemIds.push(itemId);
                }

                var lotData = getInventoryNumbers(itemIds, location);

                for (var i = 0; i < itemCount; i++) {
                    var itemId = newRecord.getSublistValue({ sublistId: "recmachcustrecord_vs_parent", fieldId: "custrecord_vs_item", line: i });
                    var qty = newRecord.getSublistValue({ sublistId: "recmachcustrecord_vs_parent", fieldId: "custrecord_vs_quantity", line: i });
                    var memoLine = newRecord.getSublistValue({ sublistId: "recmachcustrecord_vs_parent", fieldId: "custrecord_vs_memo_lines", line: i });

                    inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "item", value: itemId });
                    inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "location", value: location });
                    inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "adjustqtyby", value: -qty });

                    if (lotData[itemId]) {
                        var inventoryDetail = inventoryAdjustment.getCurrentSublistSubrecord({ sublistId: 'inventory', fieldId: 'inventorydetail' });
                        var usedLots = assignLots(inventoryDetail, lotData[itemId], qty);
                        lotUsageByItem[itemId] = usedLots;
                    }

                    inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "memo", value: memoLine });
                    inventoryAdjustment.commitLine({ sublistId: "inventory" });
                }

                var adjustmentId = inventoryAdjustment.save();

                // Load saved adjustment in non-dynamic mode to fetch costs
                var loadedAdjustment = record.load({
                    type: record.Type.INVENTORY_ADJUSTMENT,
                    id: adjustmentId,
                    isDynamic: false
                });

                var costMapByItem = {};
                var invLineCount = loadedAdjustment.getLineCount({ sublistId: 'inventory' });

                for (var i = 0; i < invLineCount; i++) {
                    var itemId = loadedAdjustment.getSublistValue({ sublistId: 'inventory', fieldId: 'item', line: i });
                    var cost = loadedAdjustment.getSublistValue({ sublistId: 'inventory', fieldId: 'unitcost', line: i });

                    costMapByItem[itemId] = cost;
                }

                // Reload the custom record
                newRecord = record.load({ type: rectype, id: recid });

                // Set adjustment ID in main field
                newRecord.setValue({
                    fieldId: 'custrecord_vs_inventory_adjustment_sourc',
                    value: adjustmentId
                });

                // Set JSON lot usage and cost in sublist
                for (var i = 0; i < itemCount; i++) {
                    var itemId = newRecord.getSublistValue({ sublistId: "recmachcustrecord_vs_parent", fieldId: "custrecord_vs_item", line: i });
                    var lotInfoArray = lotUsageByItem[itemId] || [];
                    var jsonLotInfo = JSON.stringify(lotInfoArray);

                    newRecord.setSublistValue({ sublistId: "recmachcustrecord_vs_parent", fieldId: "custrecord_vs_invdetails_items", line: i, value: jsonLotInfo });

                    var itemCost = costMapByItem[itemId];
                    if (itemCost != null) {
                        newRecord.setSublistValue({ sublistId: "recmachcustrecord_vs_parent", fieldId: "custrecord_vs_cost", line: i, value: itemCost });
                    }
                }

                // Set flag to prevent reprocessing
                if (adjustmentId) {
                    newRecord.setValue({ fieldId: 'custrecord_vs_iacreated', value: true });
                }

                newRecord.save();

                log.debug("Inventory Adjustment Created", "Adjustment ID: " + adjustmentId);

                if (adjustmentId) {
                    // Send notification email
                    var baseUrl = 'https://7939761.app.netsuite.com'; // Production domain

                    var inventoryAdjustmentUrl = baseUrl + '/app/accounting/transactions/invadjst.nl?id=' + adjustmentId;
                    var sampleRequestUrl = baseUrl + '/app/common/custom/custrecordentry.nl?id=' + recid + '&rectype=301';

                    var subject = 'Sample Request Inventory Adjustment Created (#' + adjustmentId + ')';
                    var body =
                        'Kindly Note An Inventory Adjustment has been created for the Sample Request.<br><br>' +
                        '<strong>Inventory Adjustment:</strong> <a href="' + inventoryAdjustmentUrl + '">View Inventory Adjustment</a><br>' +
                        '<strong>Sample Request:</strong> <a href="' + sampleRequestUrl + '">View Sample Request</a><br>';

                    email.send({
                        author: 414,
                        recipients: ['m.isleem@pamedco.com', 'muhsink@pamedco.com', 'jafpmr@pamedco.com'],
                        subject: subject,
                        body: body,
                        isHtml: true
                    });


                }
            }

        } catch (error) {
            log.error("ERROR!", error);
        }
    }

    function getInventoryNumbers(itemIds, location) {
        var lotData = {};

        var inventorynumberSearchObj = search.create({
            type: "inventorynumber",
            filters: [
                ["quantityavailable", "greaterthan", "0"],
                "AND",
                ["item", "anyof", itemIds],
                "AND",
                ["location", "anyof", location]
            ],
            columns: [
                search.createColumn({ name: "inventorynumber", label: "Number" }),
                search.createColumn({ name: "quantityavailable", label: "Available" }),
                search.createColumn({ name: "internalid", label: "Internal ID" }),
                search.createColumn({ name: "item", label: "Item" }),
                search.createColumn({ name: "expirationdate", label: "Expiration Date", sort: search.Sort.ASC })
            ]
        });

        var searchResults = inventorynumberSearchObj.run().getRange({ start: 0, end: 1000 });

        if (searchResults.length === 0) {
            log.debug("No lot data found", "Check if items have available lots at the given location.");
        }

        for (var i = 0; i < searchResults.length; i++) {
            var result = searchResults[i];
            var itemId = result.getValue({ name: "item" });
            var availableQty = result.getValue({ name: "quantityavailable" });
            var lotNumberID = result.getValue({ name: "internalid" });
            var lotNumberText = result.getValue({ name: "inventorynumber" });
            var expirationDate = result.getValue({ name: "expirationdate" });

            if (!lotData[itemId]) {
                lotData[itemId] = [];
            }

            lotData[itemId].push({
                lotNumberID: lotNumberID,
                lotNumberText: lotNumberText,
                availableQty: availableQty,
                expirationDate: expirationDate
            });
        }

        log.debug("Final Lot Data Retrieved (Sorted by Expiration Date)", lotData);
        return lotData;
    }

    function assignLots(inventoryDetail, availableLots, totalQtyNeeded) {
        var totalQtyAssigned = 0;
        var usedLots = [];

        for (var i = 0; i < availableLots.length && totalQtyAssigned < totalQtyNeeded; i++) {
            var lot = availableLots[i];
            var quantityToAssign = Math.min(totalQtyNeeded - totalQtyAssigned, lot.availableQty);

            inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });
            inventoryDetail.setCurrentSublistValue({
                sublistId: 'inventoryassignment',
                fieldId: 'quantity',
                value: -quantityToAssign
            });
            inventoryDetail.setCurrentSublistValue({
                sublistId: 'inventoryassignment',
                fieldId: 'issueinventorynumber',
                value: lot.lotNumberID
            });
            inventoryDetail.commitLine({ sublistId: 'inventoryassignment' });

            usedLots.push({
                lot: lot.lotNumberText,
                qty: quantityToAssign
            });

            totalQtyAssigned += quantityToAssign;
        }

        if (totalQtyAssigned < totalQtyNeeded) {
            log.error('Insufficient quantity available for item.');
        }

        return usedLots;
    }

    return {
        execute: execute
    };

});
