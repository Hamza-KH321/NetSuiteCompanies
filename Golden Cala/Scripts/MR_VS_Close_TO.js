/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {
        try {
            var transferorderSearchObj = search.create({
                type: "transferorder",
                settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "TrnfrOrd"],
                    "AND",
                    ["trandate", "notafter", "1/9/2024"],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["status", "noneof", "TrnfrOrd:H"],
                    // "AND", 
                    // ["internalid","anyof","5516"]
                ],
                columns: [
                    search.createColumn({ name: "internalid", label: "Internal ID" })
                ]
            });

            return transferorderSearchObj;
        } catch (error) {
            log.error({ title: 'Error in getInputData', details: error });
        }
    }

    function map(context) {
        try {
            var result = JSON.parse(context.value);
            var internalId = result.values.internalid.value;
            var transferOrder = record.load({type: record.Type.TRANSFER_ORDER,id: internalId,isDynamic: true});
            var lineCount = transferOrder.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < lineCount; i++) {
                transferOrder.selectLine({ sublistId: 'item', line: i });
                transferOrder.setCurrentSublistValue({sublistId: 'item',fieldId: 'isclosed',value: true});
                transferOrder.commitLine({ sublistId: 'item' });
            }

            transferOrder.save();
            log.debug({ title: 'Transfer Order Updated', details: 'Internal ID: ' + internalId });

        } catch (error) {
            log.error({ title: 'Error in map stage', details: error });
        }
    }

    return {
        getInputData: getInputData,
        map: map
    };

});
