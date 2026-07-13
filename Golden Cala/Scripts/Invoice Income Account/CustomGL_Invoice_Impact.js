/**
 * Module Description
 * 
 * Version    Date            Author           Remarks
 * 1.00       11 May 2026     hhhhh            Invoice Custom GL Impact
 *
 */
function customizeGlImpact(transactionRecord, standardLines, customLines, book) {

    try {

        var customGlAccount = transactionRecord.getFieldValue('custbody_vs_custom_gl_account');
        var total = transactionRecord.getFieldValue('total');

        nlapiLogExecution('DEBUG', 'customGlAccount', customGlAccount);
        nlapiLogExecution('DEBUG', 'total', total);

        if (customGlAccount && total > 0) {

            // Debit Line - Fixed Account 337
            var newDebitLine = customLines.addNewLine();
            newDebitLine.setAccountId(337);
            newDebitLine.setDebitAmount(total);
            newDebitLine.setMemo('Custom GL Income Account');

            // Credit Line - Custom Body Field Account
            var newCreditLine = customLines.addNewLine();
            newCreditLine.setAccountId(parseInt(customGlAccount));
            newCreditLine.setCreditAmount(total);
            newCreditLine.setMemo('Custom GL Income Account');

            nlapiLogExecution(
                'DEBUG',
                'Custom Lines Added',
                'Debit Account: 337 | Credit Account: ' + customGlAccount + ' | Amount: ' + total
            );
        }

    } catch (e) {

        nlapiLogExecution(
            'ERROR',
            'Custom GL Impact Error',
            e.toString()
        );
    }
}