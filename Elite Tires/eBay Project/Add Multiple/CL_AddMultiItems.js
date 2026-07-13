/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/record', 'N/ui/message', 'N/currentRecord'], function (record, message, currentRecord) {

    function pageInit(context) {

        // Ensure event listener is added only once when the Sales Order page loads
        if (context.mode === 'create' || context.mode === 'edit') {
            log.debug('Clien Script', context.mode);
        }
    }

    function retryOrder() {
        try {
            var currRec = currentRecord.get();
            var recordId = currRec.id;

            if (!recordId) {
                alert("Record ID not found. Please refresh and try again.");
                return;
            }

            // Save the record with an edit operation to trigger the User Event Script
            record.submitFields({
                type: 'customrecord_vs_ebay_orders_queue',
                id: recordId,
                values: { custrecord_vs_process_status: 'Retrying' }
            });

            alert("Retry initiated. Please wait while the Sales Order is created.");

            location.reload(); // Refresh the page to see the updated status

        } catch (error) {
            console.error("Error in retryOrder: ", error);
            alert("An error occurred: " + error.message);
        }
    }

    return {
        pageInit: pageInit,
        retryOrder: retryOrder
    };
});
