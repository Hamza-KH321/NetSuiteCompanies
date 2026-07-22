/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {
        return search.create({
            type: "journalentry",
            settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
            filters: [
                ["type", "anyof", "Journal"],
                "AND",
                ["trandate", "within", "31-Jan-2025", "31-Jan-2025"],
                "AND",
                ["status", "anyof", "Journal:A"],
                "AND",
                ["internalid", "noneof", "3682"],
                // "AND",
                // ["internalid", "anyof", "3809"]

            ],
            columns: [
                search.createColumn({ name: "internalid", summary: "GROUP" })
            ]
        });
    }

    function map(context) {
        try {
            var result = JSON.parse(context.value);
            var internalId = result.values["GROUP(internalid)"].value;

            log.debug('Processing Journal Entry', 'Internal ID: ' + internalId);

            var journalEntry = record.load({
                type: record.Type.JOURNAL_ENTRY,
                id: internalId,
                isDynamic: false
            });

            journalEntry.setValue({
                fieldId: 'approvalstatus',
                value: 2 // Approved
            });

            journalEntry.save();
            log.audit('Updated Journal Entry', 'ID: ' + internalId + ' marked as Approved');

        } catch (e) {
            log.error('Error in map stage', e.toString());
        }
    }

    return {
        getInputData: getInputData,
        map: map
        // No reduce or summarize needed
    };
});
