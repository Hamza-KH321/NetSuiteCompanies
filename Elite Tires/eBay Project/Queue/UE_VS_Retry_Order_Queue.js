/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/ui/serverWidget', 'N/log'], function (record, serverWidget, log) {

    function beforeLoad(context) {
        try {
            var form = context.form;
            var currentRecord = context.newRecord;

            // Get the process status text
            var processStatus = currentRecord.getText({ fieldId: 'custrecord_vs_process_status' });

            log.debug("Process Status", processStatus);

            // Only show the button if the status is NOT "Completed"
            if (processStatus !== "Completed") {
                form.addButton({
                    id: 'custpage_retry_button',
                    label: 'Retry',
                    functionName: 'retryOrder'
                });

                form.clientScriptModulePath = 'SuiteScripts/CS_VS_Retry_Button.js'; // The Client Script handles button execution
            }

        } catch (error) {
            log.error('ERROR in before load', error);
        }
    }

    return {
        beforeLoad: beforeLoad,
    };
});
