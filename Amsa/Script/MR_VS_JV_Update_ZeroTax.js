/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

 define(['N/search', 'N/record'], function(search, record) {
     function getInputData() {
         return search.create({
             type: "journalentry",
             settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
             filters: [
                 ["taxitem", "anyof", "@NONE@"],
                 "AND",
                 ["type", "anyof", "Journal"],
                 "AND",
                 [["accounttype", "anyof", "Expense", "OthExpense"], "OR", ["account", "anyof", "211"]],
                //  "AND",
                //  ["internalid", "anyof", "1697"],
                 "AND",
                 ["max(formulatext: CASE WHEN {account.id} = 211 then 'Yes' else 'No' end)", "is", "No"]
             ],
             columns: [
                 search.createColumn({ name: "tranid", summary: "GROUP" }),
                 search.createColumn({ name: "internalid", summary: "GROUP" }),
                 search.createColumn({
                     name: "formulatext",
                     summary: "MAX",
                     formula: "CASE WHEN {account.id} = 211 then 'Yes' else 'No' end"
                 })
             ]
         });
     }

     function map(context) {
        try {    
            var searchResult = JSON.parse(context.value);
            var journalId = searchResult.values["GROUP(internalid)"].value;
    
            if (!journalId) {
                log.error({ title: 'Missing Internal ID', details: journalId });
                return;
            }
    
            var journalRec = record.load({ type: record.Type.JOURNAL_ENTRY, id: journalId, isDynamic: true });
    
            var lineCount = journalRec.getLineCount({ sublistId: 'line' });
    
            for (var i = 0; i < lineCount; i++) {
                journalRec.selectLine({ sublistId: 'line', line: i });
                var accountType = journalRec.getCurrentSublistValue({ sublistId: 'line', fieldId: 'accounttype' });
    
                if (accountType === 'Expense' || accountType === 'OthExpense') {
                    journalRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'taxcode', value: 15 });
                    journalRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'tax1acct', value: 211 });
                    journalRec.commitLine({ sublistId: 'line' });
                }
            }
    
            journalRec.save();
            log.debug({ title: 'Successfully Updated Journal Entry', details: journalId });
    
        } catch (error) {
            log.error({ title: 'Error processing journal entry', details: error });
        }
    }
    
     return {
         getInputData: getInputData,
         map: map
     };
 });
