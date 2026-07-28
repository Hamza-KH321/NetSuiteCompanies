/**
 * Module Description
 *
 * Version    Date            Author
 * 1.00       15 Jan 2026     Hamza
 */

function customizeGlImpact(transactionRecord, standardLines, customLines, book) {
    try {
        nlapiLogExecution('DEBUG', 'GL Plugin', 'Start customizeGlImpact');

        var vendorId = transactionRecord.getFieldValue('entity');

        if (!vendorId) {
            nlapiLogExecution('DEBUG', 'Exit', 'No vendor on transaction');
            return true;
        }

        var vendorRec;
        var payablesAccount;

        try {
            vendorRec = nlapiLoadRecord('vendor', vendorId);
            payablesAccount = vendorRec.getFieldValue('payablesaccount');
        } catch (e) {
            nlapiLogExecution('ERROR', 'Vendor Load Failed', e.toString());
            return true;
        }

        if (!payablesAccount) {
            nlapiLogExecution('DEBUG', 'Exit', 'Vendor has no payables account');
            return true;
        }

        var amount = Number(transactionRecord.getFieldValue('payment')) || 0;

        if (amount <= 0) {
            nlapiLogExecution('DEBUG', 'Exit', 'Transaction total is zero');
            return true;
        }

        // ---------------------------
        // Credit Line - Fixed Account
        // ---------------------------
        var creditLine = customLines.addNewLine();
        creditLine.setCreditAmount(amount);
        creditLine.setAccountId(118);
        creditLine.setMemo('Custom GL Credit');

        nlapiLogExecution(
            'DEBUG',
            'Credit Line Added',
            'Account 118 | Amount ' + amount
        );

        // ---------------------------
        // Debit Line - Vendor Payables
        // ---------------------------
        var debitLine = customLines.addNewLine();
        debitLine.setDebitAmount(amount);
        debitLine.setAccountId(Number(payablesAccount));
        debitLine.setMemo('Vendor Payables');

        nlapiLogExecution(
            'DEBUG',
            'Debit Line Added',
            'Account ' + payablesAccount + ' | Amount ' + amount
        );

        nlapiLogExecution(
            'DEBUG',
            'GL Plugin',
            'End customizeGlImpact for Tran ' + transactionRecord.getFieldValue('tranid')
        );

    } catch (e) {
        nlapiLogExecution('ERROR', 'Unexpected Error', e.toString());
    }

    return true;
}
