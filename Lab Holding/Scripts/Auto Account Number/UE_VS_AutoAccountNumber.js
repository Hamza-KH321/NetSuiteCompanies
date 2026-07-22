/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search'], function (record, search) {

    /**
     * Before Submit event handler
     * Auto-generates account numbers based on parent account number prefix
     * 
     * @param {Object} context
     * @param {Record} context.newRecord - New record being submitted
     * @param {string} context.type - Event type
     */
    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.CREATE &&
            context.type !== context.UserEventType.COPY) {
            return;
        }

        var newRecord = context.newRecord;
        var parentAccountId = newRecord.getValue({ fieldId: 'parent' });

        // Only auto-generate if account number is empty
        var currentAcctNumber = newRecord.getValue({ fieldId: 'acctnumber' });
        if (currentAcctNumber != '*') {
            return;
        }

        var nextNumber;

        // If there's a parent account, use its number as prefix
        if (parentAccountId) {
            // Load parent account to get its account number
            var parentAccount = record.load({
                type: record.Type.ACCOUNT,
                id: parentAccountId,
                isDynamic: false
            });

            var parentAccountNumber = parentAccount.getValue({ fieldId: 'acctnumber' });
            var parentAccName = parentAccount.getValue({ fieldId: 'acctname' });

            if (!parentAccountNumber) {
                // If parent has no number, default to 1
                nextNumber = '1';

                var accountSearch = search.create({
                    type: search.Type.ACCOUNT,
                    filters: [
                        ['name', 'startswith', parentAccName]
                    ],
                    columns: [
                        search.createColumn({ name: 'number', summary: 'MAX' })
                    ]
                }).run().getRange({ start: 0, end: 1 });

                if (accountSearch.length > 0)
                    nextNumber = Number(accountSearch[0].getValue({ name: 'number', summary: 'MAX' })) + 1;

            } else {
                // Search for all accounts whose number starts with parent's number
                var highestNumber = 0;

                var accountSearch = search.create({
                    type: search.Type.ACCOUNT,
                    filters: [
                        ['displayname', 'startswith', parentAccountNumber]
                    ],
                    columns: [
                        search.createColumn({ name: 'number' })
                    ]
                });


                var checkParent = accountSearch.run().getRange({ start: 0, end: 1000 });
                if (checkParent.length == 1) {
                    if (checkParent[0].getValue('number') == parentAccountNumber) {
                        log.audit("parent account number is equal to the max account number, therefore no children");
                        highestNumber = parentAccountNumber + "" + "0";
                    }
                }
                else {
                    accountSearch.run().each(function (result) {
                        var acctNumber = result.getValue({ name: 'number' });

                        // Extract numeric portion from the full account number
                        var numericPortion = parseInt(acctNumber.replace(/\D/g, ''), 10);

                        if (!isNaN(numericPortion) && numericPortion > highestNumber) {
                            highestNumber = numericPortion;
                        }

                        return true;
                    });
                }
                // Generate next number by incrementing the highest
                nextNumber = String(highestNumber + 1);
            }
        } else {
            // No parent - top level account, default to 1
            nextNumber = '1';
        }

        newRecord.setValue({fieldId: 'acctnumber',value: nextNumber});
    }

    return {
        beforeSubmit: beforeSubmit
    };
});