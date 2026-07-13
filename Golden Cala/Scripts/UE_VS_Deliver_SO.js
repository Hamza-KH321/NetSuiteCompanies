/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search'],
/**
 * @param {record} record
 * @param {search} search
 */
function(record, search) {
   
    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
     */
    function beforeLoad(scriptContext) {

    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function beforeSubmit(scriptContext) {

    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */

    function afterSubmit(scriptContext) {
        var newRecord = scriptContext.newRecord;
        var soId = newRecord.getValue('custrecord_vs_so_to'); // The dynamic internal ID
    
        if (!soId) {
            log.error("Missing Order ID", "custrecord_vs_so_to is empty or undefined.");
            return;
        }
    
        try {
            // Create a search to determine if the transaction is a Sales Order or Transfer Order
            var transactionSearchObj = search.create({
                type: "transaction",
                filters: [
                    ["type", "anyof", "TrnfrOrd", "SalesOrd"],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["internalid", "anyof", soId] // Dynamically set internal ID
                ],
                columns: [
                    search.createColumn({ name: "type", label: "Type" }) // Retrieve the type
                ]
            });
    
            var recordType = null;
    
            // Run the search
            var searchResult = transactionSearchObj.run().getRange({ start: 0, end: 1 });
    
            if (searchResult.length > 0) {
                var transactionType = searchResult[0].getValue({ name: "type" });
    
                if (transactionType === "SalesOrd") {
                    recordType = "salesorder";
                } else if (transactionType === "TrnfrOrd") {
                    recordType = "transferorder";
                }
            }
    
            if (!recordType) {
                log.error("Unable to determine record type", "Transaction ID: " + soId + " does not match Sales Order or Transfer Order.");
                return;
            }
    
            log.debug("Record Type Identified", "ID: " + soId + " is a " + recordType);
    
            record.submitFields({
                type: recordType,
                id: soId,
                values: {
                    custbody_vs_so_to_delivery_note_attach: newRecord.id,
                    custbody_vs_markshipped: true
                }
            });
    
            log.debug("Successfully updated", "Updated " + recordType + " ID: " + soId);
        } catch (e) {
            log.error("Error determining record type or updating record", e);
        }
    }
     
    return {

        afterSubmit: afterSubmit
    };
    
});
