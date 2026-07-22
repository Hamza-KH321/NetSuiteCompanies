/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE_VS_VitaCare_Ticket_Comment.js
 */
define(['N/log', 'N/record', 'N/file', 'N/https'],
    function (log, record, file, https) {

        function afterSubmit(context) {
            try {
                var newRecord = context.newRecord;
                var isReply = newRecord.getValue({ fieldId: 'custevent_vs_replymessageactiv' });
                var internalonly = newRecord.getValue({ fieldId: 'internalonly' });

                log.debug('Script is Working', isReply);
                log.debug('isReply', isReply);
                log.debug('internalonly', internalonly);

                if (isReply && !internalonly) {
                    var caseNumber = newRecord.getValue({ fieldId: 'casenumber' });
                    var status = newRecord.getValue({ fieldId: 'status' });
                    var reply = newRecord.getValue({ fieldId: 'custevent_vs_reply' });
                    var fileAttachment = newRecord.getValue({ fieldId: 'custevent_vc_pmt_meth' });
                    var fileURL;

                    log.debug('caseNumber', caseNumber);
                    log.debug('status', status);
                    log.debug('reply', reply);

                    if (reply) {
                        reply = reply.replace(/<\/?p>/g, '');
                    }

                    // log.debug('Reply is:' , reply);

                    if (fileAttachment) {
                        try {
                            var fileRecord = file.load({ id: fileAttachment });
                            fileURL = fileRecord.url;
                        } catch (fileError) {
                            log.error('Error loading file attachment', fileError);
                        }
                    }

                    log.debug('fileAttachment', fileAttachment);
                    log.debug('fileURL', fileURL);

                    var ticketId = parseInt(caseNumber, 10);

                    if (isNaN(ticketId)) {
                        log.error('Invalid Case Number', 'The case number could not be converted to an integer.');
                        return;
                    }

                    log.debug('ticketId', ticketId);

                    var requestData = {
                        ticketId: ticketId,
                        status: status,
                        comment: reply,
                        attachment: fileURL
                    };

                    log.debug('Request Data is: ', requestData);

                    var token = getToken();

                    if (!token) {
                        log.error('Authentication Failed', 'Unable to retrieve token from VitaCare API.');

                        record.submitFields({
                            type: newRecord.type,
                            id: newRecord.id,
                            values: {
                                'custevent_vs_apiresponse': 'Authentication Failed'
                            }
                        });

                        return;
                    }

                    log.debug('Authentication Status', 'Token received successfully');

                    var apiUrl = 'https://test-pos.vitacareonline.com:8181/api/Integration/AddTicketComment';

                    var headers = {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    };

                    // Print full request details for debugging
                    log.debug('Full Request', {
                        url: apiUrl,
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer [TOKEN HIDDEN]'
                        },
                        body: requestData
                    });

                    var response = https.post({
                        url: apiUrl,
                        body: JSON.stringify(requestData), // Convert requestData to a JSON string
                        headers: headers
                    });

                    /* start Naji Added the ApiRequest helper to handle API requests */
                    // var isSandbox = runtime.envType === runtime.EnvType.SANDBOX;
                    // var apiUrl = isSandbox
                    //     ? ApiRequest.TConstants.ADD_TICKET_COMMENT_URL
                    //     : ApiRequest.PConstants.ADD_TICKET_COMMENT_URL;

                    // var environmentType = isSandbox ? "T" : "P";

                    // // Send request using ApiRequest helper (Auth handled by AuthModule)
                    // var response = ApiRequest.sendApiRequest(
                    //     apiUrl,
                    //     requestData,
                    //     "POST",
                    //     environmentType,
                    //     true // true = requires Auth (AuthModule will attach token)
                    // );
                    /* end of Naji addition */

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
                            'custevent_vs_apiresult': JSON.stringify(requestData)
                        }
                    });

                    if (response.code == 200) {
                        record.submitFields({
                            type: newRecord.type,
                            id: recordId,
                            values: {
                                'custevent_vs_apiresponse': 'Success'
                            }
                        });
                    } else {
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


        function getToken() {
            try {
                var authUrl = 'https://test-pos.vitacareonline.com:8181/api/Auth';

                var authData = {
                    username: 'IntegrationPRD',
                    password: '123456'
                };

                log.debug('Auth URL', authUrl);
                log.debug('Auth Username', authData.username);

                var authHeaders = {
                    'Content-Type': 'application/json'
                };

                log.debug('Sending Authentication Request', {
                    url: authUrl,
                    username: authData.username
                });

                var authResponse = https.post({
                    url: authUrl,
                    body: JSON.stringify(authData),
                    headers: authHeaders
                });

                log.debug('Auth Response Code', authResponse.code);
                log.debug('Auth Response Headers', authResponse.headers);
                log.debug('Auth Response Body', authResponse.body);

                if (authResponse.code != 200) {
                    log.error('Auth API Failed', {
                        code: authResponse.code,
                        body: authResponse.body
                    });

                    return null;
                }

                var responseBody;

                try {
                    responseBody = JSON.parse(authResponse.body);
                } catch (parseError) {
                    log.error('Error Parsing Auth Response', parseError);
                    return null;
                }

                if (!responseBody) {
                    log.error('Invalid Auth Response', 'Authentication response is empty.');
                    return null;
                }

                if (!responseBody.data) {
                    log.error('Invalid Auth Response', 'data object was not returned.');
                    return null;
                }

                if (!responseBody.data.token) {
                    log.error('Token Not Found', 'data.token was not returned from authentication API.');
                    return null;
                }

                log.debug('Token Status', 'Token retrieved successfully');

                return responseBody.data.token;

            } catch (error) {
                log.error('Error in getToken', error);
                return null;
            }
        }


        return {
            afterSubmit: afterSubmit
        };
    });