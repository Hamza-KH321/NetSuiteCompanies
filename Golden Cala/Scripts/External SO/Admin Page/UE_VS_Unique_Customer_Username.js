/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * Script Name: UE || Unique Customer Usernames
 * Description: This User Event Script ensures that the `custrecord_vs_uc_username` field in the 
 *              `customrecord_vs_customer_users` record remains unique. If a duplicate username 
 *              is found during create or edit, the script throws an error and blocks the save.
 */

define(['N/search', 'N/error', 'N/log'], function (search, error, log) {

    function beforeSubmit(context) {
        try {
            if (context.type === context.UserEventType.DELETE) return;

            var newRec = context.newRecord;
            var newUsername = newRec.getValue('custrecord_vs_uc_username');
            var currentId = newRec.id;

            if (!newUsername) return;

            var duplicateSearch = search.create({
                type: 'customrecord_vs_customer_users',
                filters: [
                    ['custrecord_vs_uc_username', 'is', newUsername],
                    'AND',
                    ['internalid', 'noneof', currentId || 0]
                ],
                columns: ['internalid']
            });

            var results = duplicateSearch.run().getRange({ start: 0, end: 1 });

            if (results.length > 0) {
                throw error.create({
                    name: 'DUPLICATE_USERNAME',
                    message: 'The username "' + newUsername + '" is already in use. Please choose a different username.',
                    notifyOff: false
                });
            }
        } catch (error) {
            log.error('Error in beforeSubmit', error.message);
            throw error.message;

        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
