/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */
define(['N/search', 'N/record', 'N/log'], function(search, record, log) {

    function execute(context) {
        
        var purchaseorderSearchObj = search.create({
            type: "purchaseorder",
            settings: [{"name":"consolidationtype","value":"ACCTTYPE"}],
            filters: [
                ["type","anyof","PurchOrd"], 
                "AND", 
                ["mainline","is","T"], 
                "AND", 
                ["trandate","onorafter","01/04/2024"], 
                "AND", 
                ["formuladate: {custbody_vs_poexpirydate}","isempty",""]
            ],
            columns: [
                search.createColumn({name: "tranid", label: "Document Number"}),
                search.createColumn({name: "internalid", label: "Internal ID"}),
                search.createColumn({name: "trandate", label: "Date"}),
                search.createColumn({name: "custbody_vs_poexpirydate", label: "PO Expiry Date"})
            ]
        });

        // log.debug('PO Saved Search Result: ' , purchaseorderSearchObj);

        var resultSet = purchaseorderSearchObj.run();
        resultSet.each(function(result) {
            var internalId = result.getValue({ name: 'internalid' });
            var tranDate = result.getValue({ name: 'trandate' });

            if (tranDate) {
                log.debug('tran date is: ' , tranDate);
                // var date = new Date(tranDate);
                // date.setDate(date.getDate() + 35);
                var newDate = addDaysToDate(tranDate,35);
                

                try {
                    log.debug('Submit Fields ' , true);
                    record.submitFields({
                        type: record.Type.PURCHASE_ORDER,
                        id: internalId,
                        values: {
                            custbody_vs_poexpirydate: newDate
                        }
                    });

                    log.debug('Success', 'Updated PO internal ID: ' + internalId + ' with new expiry date: ' + newDate);
                } catch (e) {
                    log.error('Error updating PO', 'Internal ID: ' + internalId + ' Error: ' + e.message);
                }
            }

            return true; // continue to next result
        });
    }

    function addDaysToDate(dateStr, days) {
        // Split the date string into day, month, and year components
        var parts = dateStr.split('/');
        var day = parseInt(parts[0], 10);
        var month = parseInt(parts[1], 10) - 1; // Month is zero-based in JavaScript Date object
        var year = parseInt(parts[2], 10);
    
        // Create a new Date object
        var date = new Date(year, month, day);
    
        // Add the specified number of days
        date.setDate(date.getDate() + days);
    
        // Format the new date back to dd/mm/yyyy
        var newDay = ("0" + date.getDate()).slice(-2); // Add leading zero if needed
        var newMonth = ("0" + (date.getMonth() + 1)).slice(-2); // Month is zero-based, so add 1
        var newYear = date.getFullYear();
    
        return newDay + '/' + newMonth + '/' + newYear;
    }

    return {
        execute: execute
    };
});
