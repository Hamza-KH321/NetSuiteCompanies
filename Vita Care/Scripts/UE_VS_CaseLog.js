/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/log', 'N/record', 'N/file', 'N/https', 'N/runtime'], function(log, record, file, https, runtime) {

    function afterSubmit(context) {
        try {
            var newRecord = context.newRecord;
            var isReply = newRecord.getValue({ fieldId: 'custevent_vs_replymessageactiv' });
            var internalonly = newRecord.getValue({ fieldId: 'internalonly' });

            log.debug('Script is Working',isReply);
            log.debug('isReply',isReply);
            log.debug('internalonly',internalonly);

            if (isReply && !internalonly) {
                var caseNumber = newRecord.getValue({ fieldId: 'casenumber' });
                var status = newRecord.getValue({ fieldId: 'status' });
                var reply = newRecord.getValue({ fieldId: 'custevent_vs_reply' });
                var fileAttachment = newRecord.getValue({ fieldId: 'custevent_vc_pmt_meth' });
                var fileURL;

                log.debug('caseNumber',caseNumber);
                log.debug('status',status);
                log.debug('reply',reply);

                reply = reply.replace(/<\/?p>/g, '');

                // log.debug('Reply is:' , reply);

                if (fileAttachment) {
                    try {
                        var fileRecord = file.load({ id: fileAttachment });
                        fileURL = fileRecord.url;
                    } catch (fileError) {
                        log.error('Error loading file attachment', fileError);
                    }
                } 

                log.debug('fileAttachment',fileAttachment);
                log.debug('fileURL',fileURL);

                var ticketId = parseInt(caseNumber, 10);
                if (isNaN(ticketId)) {
                    log.error('Invalid Case Number', 'The case number could not be converted to an integer.');
                    return;
                }

                log.debug('ticketId',ticketId);

                var requestData = {
                    ticketId: ticketId,
                    status: status,
                    comment: reply,
                    attachment: fileURL
                };

                log.debug('Request Data is: ', requestData);

                var apiUrl = 'https://pos.vitacareonline.com:8080/api/Integration/AddTicketComment';
                var token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1laWQiOiJ7XCJJZFwiOjIsXCJVc2VyTmFtZVwiOlwiSW50ZWdyYXRpb25QUkRcIixcIlJvbGVJZFwiOjIsXCJJc0FjdGl2ZVwiOnRydWUsXCJGdWxsTmFtZVwiOlwiSW50ZWdyYXRpb25QUkRcIixcIlRva2VuXCI6XCI0M2I5NjVkYi0xYjE0LTQ0NTctODAxYy0xMjMzMTMyMTIxMjFcIixcIkF1dGhlbnRpY2F0aW9uVHlwZVwiOm51bGwsXCJJc0F1dGhlbnRpY2F0ZWRcIjpmYWxzZSxcIkFjdG9yXCI6bnVsbCxcIkJvb3RzdHJhcENvbnRleHRcIjpudWxsLFwiQ2xhaW1zXCI6W10sXCJMYWJlbFwiOm51bGwsXCJOYW1lXCI6bnVsbCxcIk5hbWVDbGFpbVR5cGVcIjpcImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWVcIixcIlJvbGVDbGFpbVR5cGVcIjpcImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZVwifSIsIm5iZiI6MTcxOTkxMTUzMCwiZXhwIjoxNzM3MTkxNTMwLCJpYXQiOjE3MTk5MTE1MzB9.uSjX75x3le9xWHsP_A2PECT-CwDHl1DnUMauLWcCCu4';

                var headers = {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                };
                
                log.debug('Headers is:', headers);

                // Print full request details for debugging
                log.debug('Full Request', {
                    url: apiUrl,
                    headers: headers,
                    body: requestData
                });

                var response = https.post({
                    url: apiUrl,
                    body: JSON.stringify(requestData), // Convert requestData to a JSON string
                    headers: headers
                });

                log.debug('API Response', response);
                log.debug('API Response code', response.code);
                log.debug('API Response headers', response.headers);
                log.debug('API Response body', response.body);

                // if (response.code === 404) {
                //     log.error('API Endpoint Not Found', 'The API endpoint returned a 404 status code.');
                // }

                var recordId = newRecord.id;
                record.submitFields({
                    type: newRecord.type,
                    id: recordId,
                    values: {
                        'custevent_vs_apiresult': requestData
                    }
                });

                if(response.code == 200){
                    record.submitFields({
                        type: newRecord.type,
                        id: recordId,
                        values: {
                            'custevent_vs_apiresponse': 'Success'
                        }
                    });
                }else{
                    record.submitFields({
                        type: newRecord.type,
                        id: recordId,
                        values: {
                            'custevent_vs_apiresponse': 'Failed'
                        }
                    });
                }

            }

        } catch (error) {
            log.error('Error in afterSubmit', error);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
