/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Credit Memo Edit Save
 */

define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {

        try {

            log.debug('Stage', 'getInputData Started');

            var creditmemoSearchObj = search.create({
                type: "creditmemo",
                settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "CustCred"],
                    "AND",
                    ["mainline", "is", "T"]
                ],
                columns: [
                    search.createColumn({ name: "internalid", label: "Internal ID" })
                ]
            });

            log.debug('Search Created', 'Returning search object');

            return creditmemoSearchObj;

        } catch (e) {

            log.error('Error in getInputData', e);

        }
    }

    function map(context) {

        try {

            log.debug('Map Context Value', context.value);

            var result = JSON.parse(context.value);
            var creditMemoId = result.id;

            log.debug('Processing Credit Memo', creditMemoId);

            if (!creditMemoId) {
                log.debug('No ID Found', 'Skipping');
                return;
            }

            // 🔎 Load Credit Memo
            var cmRecord = record.load({
                type: record.Type.CREDIT_MEMO,
                id: creditMemoId,
                isDynamic: false
            });

            log.debug('Record Loaded', creditMemoId);

            // 🔎 Perform Edit (example: just resave)
            var savedId = cmRecord.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });

            log.debug('Record Saved Successfully', savedId);

        } catch (e) {

            log.error('Error in map for ID ' + context.key, e);

        }
    }

    return {
        getInputData: getInputData,
        map: map,
    };

});