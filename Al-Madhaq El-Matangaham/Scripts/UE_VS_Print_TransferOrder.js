/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/ui/serverWidget', 'N/file', 'N/render', 'N/record', 'N/log'],
    (serverWidget, file, render, record, log) => {

        function beforeLoad(context) {
            try {
                if (context.type === context.UserEventType.VIEW) {
                    const form = context.form;

                    // Add custom Print button
                    form.addButton({
                        id: 'custpage_print_transferorder',
                        label: 'Print Transfer Order',
                        functionName: 'onPrintTransferOrderClick'
                    });

                    // Inject client script to handle button click
                    form.clientScriptModulePath = './CS_VS_Print_TransferOrder.js';
                }
            } catch (e) {
                log.error('Error in beforeLoad', e);
            }
        }

        function afterSubmit(context) {
            try {
                if (context.type === context.UserEventType.VIEW) {
                    // Nothing to execute here yet (printing handled client-side)
                }
            } catch (e) {
                log.error('Error in afterSubmit', e);
            }
        }

        return { beforeLoad, afterSubmit };
    });
