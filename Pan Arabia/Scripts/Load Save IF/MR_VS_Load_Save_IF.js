/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/log'], function(record, search, log) {

    function getInputData() {
        try {
            return search.create({
                type: "itemfulfillment",
                settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "ItemShip"],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["formulatext: {createdfrom}", "startswith", "Sales"],
                    "AND",
                    ["custbody_vs_invoice_source", "anyof", "@NONE@"],
                    // "AND", 
                    // ["internalid","anyof","6095"]
                ],
                columns: [
                    search.createColumn({ name: "tranid", label: "Document Number" }),
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "custbody_vs_invoice_source", label: "Invoice Source" })
                ]
            });
        } catch (error) {
            log.error("Error in getInputData", error);
        }
    }

    function map(context) {
        try {
            var itemFulfillmentData = JSON.parse(context.value);
            var itemFulfillmentId = itemFulfillmentData.id;

            log.debug("Processing Item Fulfillment ID", itemFulfillmentId);

            var itemFulfillmentRec = record.load({type: record.Type.ITEM_FULFILLMENT,id: itemFulfillmentId,isDynamic: false});

            itemFulfillmentRec.save();
            log.debug("Saved Item Fulfillment", itemFulfillmentId);

        } catch (error) {
            log.error("Error in map function", error);
        }
    }


    return {
        getInputData: getInputData,
        map: map,

    };
});
