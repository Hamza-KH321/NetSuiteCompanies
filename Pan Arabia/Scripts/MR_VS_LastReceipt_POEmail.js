/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/log', 'N/search', 'N/format', 'N/email'],
function(record, log, search, format, email) {

    function getInputData() {
        log.debug('getInputData', 'Retrieving Purchase Order records with status Pending Receipt or Pending Billing/Partially Received...');
        
        // Define search filters to retrieve Purchase Orders
        var filters = [
            ['mainline', 'is', true],
            'AND',
            ['status', 'anyof', 'PurchOrd:B', 'PurchOrd:E'] // Pending Billing/Partially Received or Pending Receipt statuses
            // Add your additional search filters here, if any
        ];

        // Create search object to retrieve Purchase Orders
        var searchObj = search.create({
            type: search.Type.PURCHASE_ORDER,
            filters: filters,
            columns: ['internalid', 'trandate', 'status'] // Include necessary columns here
        });

        // Execute search and return search results
        var searchResults = searchObj.run().getRange({ start: 0, end: 1000 }); // Get up to 1000 results

        log.debug('getInputData', 'Retrieved ' + searchResults.length + ' Purchase Order records.');
        log.debug('getInputData', searchResults);

        return searchResults;
    }

    function map(context) {
        var data = context.value;
        log.debug('Data is:' , data);
        // Retrieve PO ID, date, and status from context
        var poId = data.id;
        var poDate = data.trandate;
        var poStatus = data.status.text;

        log.debug('map', 'PO ID: ' + poId + ', PO Date: ' + poDate + ', PO Status: ' + poStatus);

        // Check if the PO status is 'Pending Billing/Partially Received' or 'Pending Receipt'
        if (poStatus === 'Pending Billing/Partially Received' || poStatus === 'Pending Receipt') {
            log.debug('map', 'PO status is Pending Billing/Partially Received or Pending Receipt.');

            // Search for related item receipts
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

            log.debug('map', 'Related item receipt search results: ' + JSON.stringify(searchResults));

            // Check if there are any related item receipts
            if (searchResults && searchResults.length > 0) {
                log.debug('map', 'Related item receipt found.');

                // Retrieve details of the latest item receipt
                var latestDate = searchResults[0].getValue({ name: 'trandate' });
                var latestType = searchResults[0].getValue({ name: 'type' });
                var latestDocNumber = searchResults[0].getValue({ name: 'tranid' });

                log.debug('map', 'Latest Item Receipt - Date: ' + latestDate + ', Type: ' + latestType + ', Document Number: ' + latestDocNumber);

                // Calculate the difference in days between PO date and the latest item receipt date
                var poDateObj = format.parse({ type: format.Type.DATE, value: poDate });
                var latestDateObj = format.parse({ type: format.Type.DATE, value: latestDate });
                var differenceInDays = Math.ceil((latestDateObj.getTime() - poDateObj.getTime()) / (1000 * 3600 * 24));

                log.debug('map', 'Difference in days: ' + differenceInDays);

                // Log if the difference is more than 90 days
                // if (differenceInDays >= 1) {
                    log.debug('map', 'Difference is more than 90 days. Sending email...');

                    // Send email
                    var emailSubject = 'PO Receipt Reminder';
                    var emailBody = 'PO Number: ' + poId + '<br>Last Item Receipt ID: ' + latestDocNumber;
                    var recipients = ['h.khasawneh@ver-solutions.com'];
                    
                    email.send({
                        author: 6, // Specify the author's ID here
                        recipients: recipients,
                        subject: emailSubject,
                        body: emailBody
                    });
                // } else {
                //     log.debug('map', 'Difference is not more than 90 days. No email sent.');
                // }
            } else {
                log.debug('map', 'No related item receipt found.');
            }
        } else {
            log.debug('map', 'PO status is not Pending Billing/Partially Received or Pending Receipt. No action needed.');
        }
    }

    function reduce(context) {
        // This function is optional for your use case
        // Use it if you need to aggregate results from the map function
    }

    function summarize(summary) {
        // This function is optional for your use case
        // Use it if you need to perform any final tasks after processing all records
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };

});
