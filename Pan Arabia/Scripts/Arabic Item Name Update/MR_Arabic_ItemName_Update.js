/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/runtime', 'N/log'], function(record, search, runtime, log) {

    function getInputData() {
        try {
            return search.create({
                type: "estimate",
                settings: [{"name": "consolidationtype", "value": "ACCTTYPE"}],
                filters: [
                    ["type", "anyof", "Estimate"],
                    "AND",
                    ["mainline", "is", "T"],
                    // "AND",
                    // ["internalid", "anyof", "5914"]
                ],
                columns: [
                    search.createColumn({ name: "tranid", label: "Document Number" }),
                    search.createColumn({ name: "internalid", label: "Internal ID" })
                ]
            });
        } catch (error) {
            log.error("Error in getInputData", error);
        }
    }

    function map(context) {
        try {
            var estimateData = JSON.parse(context.value);
            var estimateId = estimateData.id;

            var estimateRec = record.load({type: record.Type.ESTIMATE,id: estimateId,isDynamic: false});

            var lineCount = estimateRec.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < lineCount; i++) {
                var itemId = estimateRec.getSublistValue({sublistId: 'item',fieldId: 'item',line: i});

                if (itemId) {
                    var itemRec = record.load({type: record.Type.INVENTORY_ITEM,id: itemId,isDynamic: false});

                    var arabicDescription = itemRec.getText({ fieldId: 'custitem5' }) || '';

                    estimateRec.setSublistValue({sublistId: 'item',fieldId: 'custcol_vs_arabic_description',line: i,value: arabicDescription});
                }
            }

            estimateRec.save();
            log.debug("Estimate Updated", estimateId);

        } catch (error) {
            log.error("Error in map function", error);
        }
    }


    return {
        getInputData: getInputData,
        map: map,
    };
});
