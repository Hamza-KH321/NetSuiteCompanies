/**
 * Module Description
 * 
 * Version    Date            Author           Remarks
 * 1.00       03 Jan 2024     NajiQ            
 *
 */
function customizeGlImpact(transactionRecord, standardLines, customLines, book) {
    var depositAccountID = parseInt(transactionRecord.getFieldValue('account'));
    var fees = transactionRecord.getFieldValue('custbody_vs_amount_custom_gl');

    nlapiLogExecution("debug", "depositAccountID is  ", depositAccountID);


    try {

        if (fees) {
           
            var debitLine = customLines.addNewLine();
            debitLine.setDebitAmount(fees);
            debitLine.setAccountId(421); 
            nlapiLogExecution("debug", "add new  ");

            
            var creditLine = customLines.addNewLine();
            creditLine.setCreditAmount(fees);
            creditLine.setAccountId(depositAccountID);
            nlapiLogExecution("debug", "add new2  ");
        }
    } catch (e) {
        nlapiLogExecution("error", "createdfrom", e.message);
    }

}