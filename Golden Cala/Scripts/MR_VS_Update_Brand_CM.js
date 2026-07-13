/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(['N/search', 'N/record', 'N/runtime', 'N/log'], function (search, record, runtime, log) {

    function getInputData() {
        try {
            return search.create({
                type: "creditmemo",
                settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "CustCred"],
                    "AND",
                    ["mainline", "is", "T"],
                    // "AND",
                    // ["internalid", "anyof", "551158"]
                ],
                columns: [
                    search.createColumn({ name: "internalid", label: "Internal ID" })
                ]
            });
        } catch (error) {
            log.error("Error in getInputData", error);
        }
    }

    function map(context) {
        try {
            var result = JSON.parse(context.value);
            var creditMemoId = result.id;
            // log.debug("Processing Credit Memo ID", creditMemoId);

            if (!creditMemoId) return;

            var creditMemo = record.load({type: record.Type.CREDIT_MEMO,id: creditMemoId,isDynamic: false});

            var lineCount = creditMemo.getLineCount({ sublistId: "item" });
            var isUpdated = false;

            for (var i = 0; i < lineCount; i++) {
                var brandValue = creditMemo.getSublistValue({sublistId: "item",fieldId: "custcol_vs_brand_line",line: i});
                var classValue = creditMemo.getSublistValue({sublistId: "item",fieldId: "class",line: i});

                if (!classValue && brandValue) {
                    creditMemo.setSublistValue({sublistId: "item",fieldId: "class",line: i,value: brandValue});
                    isUpdated = true;
                }
            }

            if (isUpdated) {
                creditMemo.save({ enableSourcing: true, ignoreMandatoryFields: true });
                log.debug("Credit Memo Updated", creditMemoId);
            }

        } catch (error) {
            log.error("Error in map", error);
        }
    }

    return {
        getInputData: getInputData,
        map: map
    };
});
