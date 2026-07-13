/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */

define(['N/record', 'N/log', 'N/search'], function(record, log,search) {
    
    function onRequest(context) {
        if (context.request.method === 'GET') {
            var ticketNumber = context.request.parameters.ticket_number;
            if (ticketNumber) {
                var caseStatus = getCaseStatus(ticketNumber);
                context.response.write(JSON.stringify({ status: caseStatus }));
            } else {
                context.response.write('Ticket number is required.');
            }
        }
    }
    
    function getCaseStatus(ticketNumber) {

        var supportcaseSearchObj = search.create({
            type: "supportcase",
            filters:
            [
               ["number","equalto",ticketNumber]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "casenumber", label: "Number"}),
               search.createColumn({name: "status", label: "Status"})
            ]
         });

         var searchResults = supportcaseSearchObj.run().getRange({start: 0, end: 1});

         if (searchResults.length == 0) {
            var caseNumberIsWrong = 'Ticket number is Wrong, please enter valued Ticket Number.'
            return caseNumberIsWrong;
            };

         var internalId = searchResults[0].getValue({
            name: 'internalid'
        });
        // Assuming 'case' is the record type for the case support record.
        var caseRecord = record.load({
            type: 'supportcase',
            id: internalId
        });
        
        // Retrieve the status field value
        var caseStatus = caseRecord.getValue({
            fieldId: 'status'
        });

        return caseStatus;
    }

    return {
        onRequest: onRequest
    };
});
