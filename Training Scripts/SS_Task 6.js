/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */
define(['N/search', 'N/log', 'N/email'], function (search, log, email) {

    function execute(context) {
        
try {
            var customerSearch = search.load({
                id: 'customsearch1733' 
            });
    
            var b2bCount = 0;
            var nonB2BCount = 0;
    
            // log.debug({title: 'b2bCount' , details: b2bCount});
            // log.debug({title: 'nonB2BCount' , details: nonB2BCount});
    
            customerSearch.run().each(function (result) {
                var name = result.getValue({ name: 'entityid' });
                var category = result.getValue({ name: 'category' }); 
                var phone = result.getValue({ name: 'phone' });
    
                // log.debug({ title: 'Customer name', details: name});
                // log.debug({ title: 'Customer category', details: category});
                // log.debug({ title: 'Customer phone', details: phone});
    
                if (category === 'B2B') {
                    log.debug({ title: 'Customer Log', details: 'Customer ' + name + ' is B2B.' });
                    b2bCount++;
                } else {
                    log.debug({ title: 'Customer Log', details: 'Customer ' + name + ' is not B2B.' });
                    nonB2BCount++;
                }
    
                return true;
            });
    
            log.debug({ title: 'Customer Count Log', details: 'B2B Customers: ' + b2bCount + ', Non-B2B Customers: ' + nonB2BCount });
    
            var emailBody = 'Hello Hamza,\n\nThe customer Count shows as the following:\n\nB2B Customers: ' + b2bCount + '\nNon-B2B Customers: ' + nonB2BCount + '\n\nBest regards';
            
            email.send({
                author: employeeInternalId,
                recipients: 'h.khasawneh@ver-solutions.com',
                subject: 'Customer Count Information',
                body: emailBody
            });
} catch (error) {
    log.debug({ title: 'ERROR', details: error});
}
    }

    return {
        execute: execute
    };
});