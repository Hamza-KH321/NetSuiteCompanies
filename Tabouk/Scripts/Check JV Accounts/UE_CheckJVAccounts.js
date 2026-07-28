/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function(record, log) {

    function beforeSubmit(context) {
        var newRecord = context.newRecord;

        // Get the number of lines on the Journal Entry record
        var lineCount = newRecord.getLineCount({
            sublistId: 'line'
        });

        for (var i = 0; i < lineCount; i++) {
            var accountId = newRecord.getSublistValue({
                sublistId: 'line',
                fieldId: 'account',
                line: i
            });

            var accountType = getAccountType(accountId);
            log.debug('Account ID is: ' , accountId);

            var isManager = newRecord.getValue({fieldId: "custbody_vs_managerapproval"});
            log.debug('isManager: ' , isManager);

            if (accountType == 'LongTermLiab' || accountType == 'Equity' || accountType == 'OthAsset')
            {
                newRecord.setValue({
                    fieldId: 'custbody_vs_managerapproval',
                    value: true,
                    ignoreFieldChange: true
                });
            }
            

        }
    }

    function getAccountType(accountId) {
        var accountRecord = record.load({
            type: record.Type.ACCOUNT,
            id: accountId
        });

        var accountType = accountRecord.getValue({
            fieldId: 'accttype'
        });

        log.debug('Account Type is: ' , accountType);

        return accountType;
    }

    return {
        beforeSubmit: beforeSubmit
    };

});
