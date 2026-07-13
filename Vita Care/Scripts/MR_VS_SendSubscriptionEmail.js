/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/email', 'N/runtime', 'N/record', 'N/log'], 
    function(search, email, runtime, record, log) {
        function getInputData() {
            try {
                var entitySearchObj = search.create({
                    type: "entity",
                    filters: [
                        ["type", "anyof", "CustJob"], 
                        "AND", 
                        ["email", "isnotempty", ""]
                        // , 
                        // "AND", 
                        // ["internalid", "anyof", "19"]
                    ],
                    columns: [
                        search.createColumn({name: "internalid", label: "Internal ID"}),
                        search.createColumn({name: "entityid", label: "ID"}),
                        search.createColumn({name: "altname", label: "Name"}),
                        search.createColumn({name: "type", label: "Primary Type (Deprecated)"}),
                        search.createColumn({name: "email", label: "Email"})
                    ]
                });

                var pagedData = entitySearchObj.runPaged({ pageSize: 1000 });
                var results = [];

                pagedData.pageRanges.forEach(function(pageRange) {
                    var page = pagedData.fetch({ index: pageRange.index });
                    page.data.forEach(function(result) {
                        var internalId = result.getValue({ name: 'internalid' });
                        var emailAddr = result.getValue({ name: 'email' });
                        var name = result.getValue({ name: 'altname' });

                        results.push({
                            internalid: internalId,
                            email: emailAddr,
                            name: name
                        });
                    });
                });

                return results;
            } catch (error) {
                log.error('ERRORRRR Get Data Stage', error);
            }
        }
    
        function map(context) {
            try {
                var searchResult = JSON.parse(context.value);
                var internalId = searchResult.internalid;
                var emailAddr = searchResult.email;
                var name = searchResult.name;
    
                context.write({
                    key: internalId,
                    value: {
                        email: emailAddr,
                        name: name
                    }
                });
    
                // log.debug('Map Stage, searchResult: ', searchResult);
                // log.debug('Map Stage, internalId: ', internalId);
                // log.debug('Map Stage, emailAddr: ', emailAddr);
                // log.debug('Map Stage, name: ', name);
            } catch (error) {
                log.error('ERRORRRR map Stage', error);
            }
        }
    
        function reduce(context) {
            try {
                var key = context.key;
                var values = JSON.parse(context.values[0]); // Assuming there's only one value per key
    
                var emailAddr = values.email;
                var name = values.name;
    
                // log.debug('Reduce Stage, emailAddr: ', emailAddr);
                // log.debug('Reduce Stage, name: ', name);
    
                // Construct the URL with the internalId
                var url = 'https://7065838.extforms.netsuite.com/app/crm/marketing/campaignlistener.nl?c=7065838&__lstr=__su&__e=' + key + '&__oi=c&__h=AAFdikaIZiDQi819tpfYPJbTEfl6n_IIh2G4TOpHX3GZcLN-rK0';
                
                // HTML body for the email
                var emailBody = '<div style="text-align: right;">' +
                    'عزيزي العميل<br><br>' +
                    'من فيتا كير نتواصل معكم<br><br>' +
                    'هل ترغب في الاشتراك في قائمة النشرات الإخبارية و الإعلامية ؟<br>' +
                    'الرجاء اختيار (نعم) خلال زيارة الرابط ' +
                    '<a href="' + url + '">(اضغط هنا)</a><br><br>' +
                    'في حالة اشتراكك بالفعل و ترغب في الإلغاء.<br><br>' +
                    'يمكنك الغاء الاشتراك من خلال اعدادات الايميل الخاص بك<br><br>' +
                    'شكرًا لكم' +
                    '</div>';
    
                // Log before sending email
                // log.audit('Sending Email', 'Sending email to ' + emailAddr + ' with name ' + name);
    
                // Send email to customer
                email.send({
                    author: 432022, // Use the current user ID
                    recipients: emailAddr,
                    subject: 'أخبار فيتاكير',
                    body: emailBody,
                    bodyType: 'HTML'
                });
    
                // Log after sending email with internal ID
                log.audit('Email Sent', 'Email sent to ' + name + ' (Internal ID: ' + key + ')');
            } catch (error) {
                log.error('ERRORRRR reduce Stage', error);
            }
        }
    
        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce
        };
    });
