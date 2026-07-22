/**
 * Module Description
 * 
 * Version    Date            Author           Remarks
 * 1.00       17 Jan 2024     NajiQ            Customer Deposit Gl impact lines 
 *
 */
function customizeGlImpact(transactionRecord, standardLines, customLines, book) {
    var customer = transactionRecord.getFieldValue('customer');
    var payment = transactionRecord.getFieldValue('payment');

    try {
        nlapiLogExecution("debug", "customer", customer);

        var receivablesAccount = parseInt(getCustomerReceivablesAccount(customer));
        nlapiLogExecution("debug", "receivablesAccount", receivablesAccount);

        if (receivablesAccount) {
            for (var i = 0; i < standardLines.getCount(); i++) {
                var line = standardLines.getLine(i);
                var debitAmount = line.getDebitAmount();
                var creditAmount = line.getCreditAmount();
                if (creditAmount > 0) {

                    var newDebitLine = customLines.addNewLine();
                    newDebitLine.setAccountId(line.getAccountId());
                    newDebitLine.setDebitAmount(line.getCreditAmount());

                    var newCreditLine = customLines.addNewLine();
                    newCreditLine.setAccountId(receivablesAccount);
                    newCreditLine.setCreditAmount(line.getCreditAmount());
                }

            }
        }


    } catch (e) {
        nlapiLogExecution("error", "Custom GL Impact Error", e.message);
    }


    function getCustomerReceivablesAccount(customerId) {
        try {
            var customerRecord = nlapiLoadRecord('customer', customerId);
            var receivablesAccountId = customerRecord.getFieldValue('receivablesaccount');
            return receivablesAccountId; // This will be the internal ID of the account.
        } catch (e) {
            nlapiLogExecution('ERROR', 'Error retrieving customer receivables account', 'Customer ID: ' + customerId + ', Error: ' + e.toString());
            return null; // Return null in case of any errors.
        }
    }

}