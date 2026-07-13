/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */
define(['N/record', 'N/log'], function(record, log) {

    function execute(context) {
        // Search for invoices where the date is greater than today's date
        try {
            var invoiceSearch = record.create({
                type: record.Type.INVOICE,
                isDynamic: false,
                filters: [['trandate', 'after', 'today']]
            });
    
            var searchResults = invoiceSearch.run().getRange({ start: 0, end: 1000 });
    
            if (searchResults && searchResults.length > 0) {
                for (var i = 0; i < searchResults.length; i++) {
                    var invoiceId = searchResults[i].id;
    
                    // Load the invoice record
                    var invoiceRecord = record.load({
                        type: record.Type.INVOICE,
                        id: invoiceId,
                        isDynamic: true
                    });
    
                    // Get today's date
                    var today = new Date();
                    today.setHours(0, 0, 0, 0);
    
                    log.debug({title: 'today\'s Date is',details: today})
    
                    // Get the invoice date from the record
                    var invoiceDate = invoiceRecord.getValue({
                        fieldId: 'trandate'
                    });
                    log.debug({title: 'Invoice Date is',details: invoiceDate})
    
    
                    // Compare the invoice date with today's date
                    if (invoiceDate > today) {
                        // If invoice date is greater than today, set it to today's date
                        invoiceRecord.setValue({
                            fieldId: 'trandate',
                            value: today
                        });
    
                        // Save the modified invoice record
                        invoiceRecord.save();
                        log.debug('Invoice Updated', 'Invoice ID ' + invoiceId + ' date set to today.');
                    }
                }
            } else {
                log.debug('No Invoices Found', 'No invoices found with date greater than today.');
            }
        } catch (error) {
            log.debug({title: 'ERROR', Details:''} );
        }
    }

    return {
        execute: execute
    };

});
