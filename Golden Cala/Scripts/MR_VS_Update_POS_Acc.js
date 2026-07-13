/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {
        try {
            var inventoryadjustmentSearchObj = search.create({
                type: "inventoryadjustment",
                settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "InvAdjst"],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["custbody_vs_source", "startswith", "POS"],
                    // "AND", 
                    // ["internalid","anyof","31427"]
                ],
                columns: [
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "tranid", label: "Document Number" }),
                    search.createColumn({ name: "account", label: "Account" }),
                    search.createColumn({ name: "custbody_vs_source", label: "Source" })
                ]
            });

            return inventoryadjustmentSearchObj;
        } catch (error) {
            log.error("Error in getInputData", error);
        }
    }

    function map(context) {
        try {
            var result = JSON.parse(context.value);
            var internalId = result.id;
            var newAccountId = 834;

            if (internalId && newAccountId) {
                var inventoryAdjRecord = record.load({type: record.Type.INVENTORY_ADJUSTMENT,id: internalId,isDynamic: true});

                inventoryAdjRecord.setValue({fieldId: 'account',value: newAccountId});

                var recordId = inventoryAdjRecord.save();
                log.audit("Inventory Adjustment Updated", { internalId: recordId, newAccountId: newAccountId });
            }
        } catch (error) {
            log.error("Error in map function", error);
        }
    }

    return {
        getInputData: getInputData,
        map: map,

    };
});
