/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/search', 'N/log'],

function(search, log) {

    function beforeSubmit(context) {
try {
    
            var newRecord = context.newRecord;
    
            var customerID = newRecord.getValue({
             fieldId: "entity"
           });
           var transactionSearchObj = search.create({
            type: "transaction",
            filters:
            [
               ["type","anyof","Estimate","SalesOrd"], 
               "AND", 
               ["mainline","is","T"], 
               "AND", 
               ["customermain.internalid","anyof",customerID]
            ],
            columns:
            [
               search.createColumn({name: "tranid", label: "Document Number"})
            ]
         });
    
            var searchResults = transactionSearchObj.run().getRange({ start: 0, end: 1000 }); // Adjust the range as needed
            var numberOfLines = searchResults.length;
    
            log.debug({title: 'Number of Lines: ',details: numberOfLines});
            log.debug({title: 'Customer ID: ',details: customerID});
    
            newRecord.setValue({
                fieldId: 'custbody_vs_numoftran', // Adjust the fieldId based on your custom field
                value: numberOfLines
            });
} catch (error) {

    log.error('ERROR!!!' , error);
    
}
    }

    return {
        beforeSubmit: beforeSubmit
    };

});
