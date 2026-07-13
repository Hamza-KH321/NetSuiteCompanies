/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log', 'N/search'], function(record, log, search) {

try {
        function afterSubmit(context) {
                var newRecord = context.newRecord;
                var poNumber = newRecord.getValue({fieldId: 'custrecord_vs_fromtransaction'});

                log.debug('PO Number is' , poNumber);
    
                if (poNumber) {
                    deletePurchaseOrder(poNumber);
                }
           
        }
    
        function deletePurchaseOrder(poNumber) {
            var poSearch = search.create({
                type: "purchaseorder",
                filters:
                [
                   ["type","anyof","PurchOrd"], 
                   "AND", 
                   ["mainline","is","T"], 
                   "AND", 
                   ["purchaseorder","anyof",poNumber]
                ],
                columns:
                [
                   search.createColumn({name: "transactionnumber", label: "Transaction Number"}),
                   search.createColumn({name: "tranid", label: "Document Number"}),
                   search.createColumn({name: "internalid", label: "Internal ID"})
                ]
             });
    
            var poSearchResults = poSearch.run().getRange({ start: 0, end: 1 });
    
            if (poSearchResults.length > 0) {
                var poId = poSearchResults[0].id;
                record.delete({type: record.Type.PURCHASE_ORDER,id: poId});
    
                log.debug({
                    title: 'Purchase Order Deleted',
                    details: 'Deleted Purchase Order Number: ' + poNumber
                });
            } else {
                log.debug({
                    title: 'Purchase Order Not Found',
                    details: 'No purchase order found with the specified number: ' + poNumber
                });
            }
        }
} catch (error) {
    log.error('ERROR' , error);
}

    return {
        afterSubmit: afterSubmit
    };

});
