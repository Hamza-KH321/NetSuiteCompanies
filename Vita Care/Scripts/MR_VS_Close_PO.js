/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log'], function(search, record, log) {
    
    function getInputData() {
        try {
            return search.create({
                type: "purchaseorder",
                settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "PurchOrd"],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["memo", "contains", "wasfa"],
                    "AND",
                    ["status", "noneof", "PurchOrd:H"],
                    "AND",
                    ["trandate", "before", "01/03/2025"],
                    // "AND",
                    // ["internalid", "anyof", "2052838"]
                ],
                columns: [
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "tranid", label: "Document Number" }),
                    search.createColumn({ name: "trandate", label: "Date" }),
                    search.createColumn({ name: "statusref", label: "Status" })
                ]
            });
        } catch (error) {
            log.error({ title: "getInputData Error", details: error });
        }
    }

    function map(context) {
        try {
            var result = JSON.parse(context.value);
            var poId = result.id;
            
            if (poId) {
                var poRecord = record.load({ type: record.Type.PURCHASE_ORDER, id: poId, isDynamic: false });

                var itemCount = poRecord.getLineCount({ sublistId: 'item' });

                for (var i = 0; i < itemCount; i++) {
                    poRecord.setSublistValue({
                        sublistId: 'item',
                        line: i,
                        fieldId: 'isclosed',
                        value: true
                    });
                }

                poRecord.save();
                log.audit({ title: "Updated PO", details: "PO ID: " + poId + " - All items set to closed" });
            }
        } catch (error) {
            log.error({ title: "map Error - PO ID: " + poId, details: error });
        }
    }

    return {
        getInputData: getInputData,
        map: map,
    };
});
