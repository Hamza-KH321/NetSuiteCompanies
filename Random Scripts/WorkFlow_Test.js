/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */

define(['N/ui/serverWidget', 'N/log', 'N/runtime'], function(serverWidget, log, runtime) {

    function onAction(context) {
        // Get the current user's role
try {
            var userRole = runtime.getCurrentUser().role;
            log.debug({
                title: 'user role is:',
                details: userRole
            });
            // Check if the user has the administrator role
            //if (userRole.toLowerCase() === 'administrator') { // Correcting the toLowerCase() usage
                // Create a form
                var form = serverWidget.createForm({
                    title: 'Approve or Reject'
                });
    
                // Add buttons for Approve and Reject
                form.addButton({
                    id: 'custpage_approve',
                    label: 'Approve',
                    functionName: 'onApproveClick'
                });
    
                form.addButton({
                    id: 'custpage_reject',
                    label: 'Reject',
                    functionName: 'onRejectClick'
                });
    
                // Return the form
                context.form = form;
            //}
} catch (error) {
    log.debug({title:'ERRRORRRR!!' ,details: error});
}
    }

    // Function to handle Approve button click
    function onApproveClick() {
        // Implement your logic for Approve action here
        alert('Approve button clicked');
    }

    // Function to handle Reject button click
    function onRejectClick() {
        // Implement your logic for Reject action here
        alert('Reject button clicked');
    }

    return {
        onAction: onAction
    };

});
