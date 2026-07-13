    /**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
    define(['N/record'],
    /**
 * @param{record} record
 */
    (record) => {
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
try{
    var newRecord = scriptContext.newRecord;
    var rec = record.load({
        type: record.Type.INVOICE,
        id: newRecord.id,
        isDynamic:false
    });

            for (var i = 0; i < 1; i++) {
                var quantity = rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'inventorydetail',
                    line: i
                });

                var test_rec = record.load({
                    type: record.Type.INVENTORY_DETAIL,
                    id: quantity
                });
                log.debug('test_rec', test_rec);
        
                var serialLotNumber = rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'serialnumber', // Replace with the correct field ID
                    line: i
                });
        
                var expirationDate = rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'expirationdate', // Replace with the correct field ID
                    line: i
                });
            log.debug('quantity', quantity);
            log.debug('serialLotNumber', serialLotNumber);
            log.debug('expirationDate',expirationDate );
            }
        }
        catch(e){ 
            log.error('Saif' , e);
        }
        }

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
