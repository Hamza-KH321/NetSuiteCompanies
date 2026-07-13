/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/action', 'N/log', 'N/record', 'N/recordContext', 'N/ui/message'],
    /**
 * @param{action} action
 * @param{log} log
 * @param{record} record
 * @param{recordContext} recordContext
 * @param{message} message
 */
    (action, log, record, recordContext, message) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

            var customRecord = record.load({
                type: 'customrecord_vs_inventorytransactionlock',
                id: 2,
                isDynamic: true
            })
    
            var rec = scriptContext.currentRecord;
            var transactionDate = rec.getText({ fieldId: 'trandate' }); 
            var startDate = customRecord.getText({ fieldId: 'custrecord_vs_startdate' });
            var endDate = customRecord.getText({ fieldId: 'custrecord_vs_endadate' });
    
            // Formating Date to Day/Month/ Year 1/8/2023
            var formattedDate1 = format.format({ value: transactionDate, type: format.Type.DATE });
            var formattedDate2 = format.format({ value: startDate, type: format.Type.DATE });
            var formattedDate3 = format.format({ value: endDate, type: format.Type.DATE });
    
            // alert(formattedDate1)
            // alert(formattedDate2)
            // alert(formattedDate3)
    
            if(transactionDate >= formattedDate2 && transactionDate <= formattedDate3)
            {
                message.create({
                    title: 'Error',
                    message: 'you cannot add/Edit this Transaction because it&quot;s Locked.',
                    type: message.Type.ERROR}).show();
            }
        }

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
