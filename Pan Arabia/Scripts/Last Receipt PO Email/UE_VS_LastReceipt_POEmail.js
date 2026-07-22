/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log', 'N/search', 'N/format', 'N/email'],
function(record, log, search, format, email) {

    function afterSubmit(context) {
        try {
            // Get the current record
            var newRecord = context.newRecord;

            // Get the PO ID and PO date
            var poId = newRecord.id;
            var poDate = newRecord.getValue({ fieldId: 'trandate' }); // Assuming 'trandate' is the field ID for PO date

            // Search for related records (bills and receipts) associated with the PO
            var relatedRecordsSearch = search.create({
                type: search.Type.TRANSACTION,
                filters: [
                    ['createdfrom', 'is', poId],
                    'AND',
                    ['mainline', 'is', true], // Only mainline transactions (bills and receipts)
                    'AND',
                    ['type', 'anyof', 'ItemRcpt'] // Only item receipts
                ],
                columns: [
                    search.createColumn({ name: 'trandate', sort: search.Sort.DESC }), // Sort by transaction date in descending order
                    search.createColumn({ name: 'type', label: 'Type' }),
                    search.createColumn({ name: 'tranid', label: 'Document Number' })
                ]
            });

            // Run the search
            var searchResults = relatedRecordsSearch.run().getRange({ start: 0, end: 1 }); // Get only the first result (max date)

            // Initialize variables to store details of the latest item receipt
            var latestDate;
            var latestType;
            var latestDocNumber;

            // Iterate through search results to find the latest item receipt
            searchResults.forEach(function(result) {
                var date = result.getValue({ name: 'trandate' });
                var type = result.getValue({ name: 'type' });
                var docNumber = result.getValue({ name: 'tranid' });

                // Update the latest details
                latestDate = date;
                latestType = type;
                latestDocNumber = docNumber;
            });

            if (latestDate) {
                // Calculate the difference in days between PO date and the latest item receipt date
                var poDateObj = format.parse({ type: format.Type.DATE, value: poDate });
                var latestDateObj = format.parse({ type: format.Type.DATE, value: latestDate });
                var differenceInDays = Math.ceil((latestDateObj.getTime() - poDateObj.getTime()) / (1000 * 3600 * 24));

                log.debug('Date Difference: ' , differenceInDays);

                // Log if the difference is more than 90 days
                if (differenceInDays >= 1) {
                    log.debug('Item Receipt Date Difference', 'Difference: ' + differenceInDays + ' days. Latest Item Receipt Details - Date: ' + latestDate + ', Type: ' + latestType + ', Document Number: ' + latestDocNumber);
                    
                    // Send email
                    var emailSubject = 'PO Receipt Reminder';
                    var emailBody = 'PO Number: ' + poId + '<br>Last Item Receipt ID: ' + latestDocNumber;
                    var recipients = ['h.khasawneh@ver-solutions.com', 'naji.q@ver-solutions.com'];
                    
                    email.send({
                        author: -5,//context.currentRecord.id, Employee ID 
                        recipients: recipients,
                        subject: emailSubject,
                        body: emailBody
                    });
                }
            } else {
                log.debug('No Item Receipt Found', 'No item receipt associated with the PO.');
            }
            
        } catch (error) {
            log.error({
                title: 'Error in user event script',
                details: error
            });
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});
