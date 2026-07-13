/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/search', 'N/record'], function(search, record) {
    function fieldChanged(context) {
        // Check if the field that was changed is 'title'
        if (context.fieldId === 'title') {
            var currentRecord = context.currentRecord;
            var caseCreatorId = currentRecord.getValue('custevent_vs_case_creator');
            
            // Proceed only if there is a value in 'custevent_vs_case_creator'
            if (caseCreatorId) {
                // Load the employee record to get the email
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
                    currentRecord.setValue({
                        fieldId: 'custevent_vs_creatoremail',
                        value: email
                    });
                    
                    return true; // Continue to the next result (if any)
                });
            }
        }
    }

    return {
        fieldChanged: fieldChanged
    };
});
