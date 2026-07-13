/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/search', 'N/record'], function(search, record) {
    
    function beforeSubmit(context) {
        var newRecord = context.newRecord;
        var caseCreatorId = newRecord.getValue('custevent_vs_case_creator');

        // Proceed only if there is a value in 'custevent_vs_case_creator'
        if (caseCreatorId) {
            // Perform a search to get the email of the employee
            search.create({
                type: search.Type.EMPLOYEE,
                filters: [
                    ['internalid', 'is', caseCreatorId]
                ],
                columns: ['email']
            }).run().each(function(result) {
                // Get the email address
                var email = result.getValue('email');
                
                // Set the value of 'custevent_vs_creatoremail'
                newRecord.setValue({
                    fieldId: 'custevent_vs_creatoremail',
                    value: email
                });
                
                return true; // Continue to the next result (if any)
            });
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
