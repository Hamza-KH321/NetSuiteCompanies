/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/log', 'N/format'],
    function(record, log, format) {
        
        function beforeSubmit(context) {
            try {
                // Check if the record is a new purchase order
                if (context.type === context.UserEventType.CREATE) {
                    log.debug('Creating PO');

                        // Get today's date
                        var today = new Date();
                        
                        // Add 30 days to today's date
                        var expirationDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
                        log.debug('expirationDate PO' , expirationDate);
                        // Format the expiration date as MM/DD/YYYY
                        var formattedExpirationDate = format.format({
                            value: expirationDate,
                            type: format.Type.DATE
                        });
                        log.debug('formattedExpirationDate PO' , formattedExpirationDate);
                        // Set the expiration date field value and make it mandatory
                        context.newRecord.setValue({
                            fieldId: 'custbody_vs_expirationdate',
                            value: formattedExpirationDate,
                            ignoreFieldChange: true // To prevent triggering field change events
                        });

                        // Make the expiration date field mandatory
                        context.newRecord.getField({ fieldId: 'custbody_vs_expirationdate' }).isMandatory = true;
                }
            } catch (e) {
                log.error({
                    title: 'Error in beforeSubmit',
                    details: e
                });
            }
        }

        return {
            beforeSubmit: beforeSubmit
        };
    });
