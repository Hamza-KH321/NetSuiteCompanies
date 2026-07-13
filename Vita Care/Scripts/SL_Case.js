/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/log', 'N/file', 'N/https', 'N/encode'],
    function (record, search, log, file, https, encode) {

        function onRequest(context) {
            try {
                log.debug('onRequest', 'Request received');

                if (context.request.headers.token != 'cd7f72c0851d4366a261005b3783908e') {
                    log.error('Token Validation', 'Invalid token');
                    return context.response.write('wrong token');
                }

                let request;
                try {
                    request = JSON.parse(context.request.body);
                } catch (e) {
                    log.error('Invalid JSON', e);
                    return context.response.write('Invalid JSON body');
                }

                log.debug('Request Body', request);

                let Case = record.create({ type: 'supportcase' });

                Case.setValue({ fieldId: 'customform', value: 310 });
                Case.setValue({ fieldId: 'custevent_vs_createdfromodoo', value: true });
                Case.setValue({ fieldId: 'custevent7', value: false });

                // Subject
                if (!request.hasOwnProperty('subject') || !request.subject) {
                    return context.response.write('Subject is mandatory');
                }
                Case.setValue({ fieldId: 'title', value: request.subject });

                // Customer by Name
                if (request.hasOwnProperty('Name')) {
                    let custResults = search.create({
                        type: "customer",
                        filters: [["entityid", "is", request.Name]],
                        columns: [
                            search.createColumn({ name: 'custentitycus_reg_id_001' })
                        ]
                    }).run().getRange({ start: 0, end: 1 });

                    log.debug('custResults', custResults);

                    if (custResults && custResults.length > 0) {

                        Case.setValue({ fieldId: 'company', value: custResults[0].id });

                        let customerRegion = custResults[0].getValue({ name: 'custentitycus_reg_id_001' });
                        log.debug('customerRegion', customerRegion);
                        if (customerRegion) {
                            Case.setValue({ fieldId: 'custevent_vs_customer_region', value: customerRegion });
                        }

                    } else {
                        return context.response.write('Customer not found');
                    }
                } else {
                    return context.response.write('Customer name is mandatory');
                }

                if (request.Email && request.Email.trim() !== "") {
                    Case.setValue({ fieldId: 'email', value: request.Email });
                }
                if (request.Phone) {
                    Case.setValue({ fieldId: 'phone', value: request.Phone });
                }
                if (request.Message) {
                    Case.setValue({ fieldId: 'incomingmessage', value: request.Message });
                }
                if (request.CaseType) {
                    Case.setValue({ fieldId: 'custevent_vs_casetype', value: request.CaseType });
                }
                if (request.UserName) {
                    Case.setValue({ fieldId: 'custevent_vs_pos_username', value: request.UserName });
                }
                if (request.Address) {
                    Case.setValue({ fieldId: 'custevent_vs_address', value: request.Address });
                }
                if (request.CaseCategory) {
                    Case.setValue({ fieldId: 'custevent2', value: request.CaseCategory });
                }
                if (request.CaseSubCategory) {
                    Case.setValue({ fieldId: 'custevent3', value: request.CaseSubCategory });
                }
                if (request.Rating) {
                    Case.setValue({ fieldId: 'custevent8', value: request.Rating });
                }

                // Attachment
                if (request.Attachment && request.Attachment.trim() !== "") {
                    try {
                        let response = https.get({ url: request.Attachment });

                        // Determine filename
                        let fileName = 'Attachment_' + new Date().getTime();
                        let urlParts = request.Attachment.split('/');
                        if (urlParts.length > 0) {
                            fileName = urlParts[urlParts.length - 1];
                        }
                        let fileExtension = fileName.split('.').pop().toLowerCase();

                        let fileType;
                        switch (fileExtension) {
                            case 'jpg':
                            case 'jpeg': fileType = file.Type.JPGIMAGE; break;
                            case 'png': fileType = file.Type.PNGIMAGE; break;
                            case 'gif': fileType = file.Type.GIFIMAGE; break;
                            case 'pdf': fileType = file.Type.PDF; break;
                            case 'xlsx': fileType = file.Type.EXCEL; break;
                            case 'docx': fileType = file.Type.WORD; break;
                            case 'txt': fileType = file.Type.PLAINTEXT; break;
                            case 'csv': fileType = file.Type.CSV; break;
                            case 'zip': fileType = file.Type.ZIP; break;
                            default: throw new Error('Unsupported file extension: ' + fileExtension);
                        }

                        // Convert to base64
                        let base64Contents = encode.convert({
                            string: response.body,
                            inputEncoding: encode.Encoding.BASE_64,
                            outputEncoding: encode.Encoding.BASE_64
                        });

                        let fileObj = file.create({
                            name: 'Attachment_' + new Date().getTime() + '.' + fileExtension,
                            fileType: fileType,
                            contents: base64Contents,
                            folder: 936619
                        });
                        let fileId = fileObj.save();

                        // Save file reference
                        Case.setValue({ fieldId: 'custevent_vc_pmt_meth', value: fileId });
                    } catch (e) {
                        log.error('Attachment Error', e);
                    }
                }

                // Branch
                if (request.custevent_vs_casebranch) {
                    let branchInternalId = request.custevent_vs_casebranch;
                    Case.setValue({ fieldId: 'custevent_vs_casebranch', value: branchInternalId });
                }

                if (request.priority) {
                    Case.setValue({ fieldId: 'priority', value: request.priority });
                }

                Case.setValue({ fieldId: 'status', value: 1 });

                let CaseId = Case.save({ enableSourcing: true, ignoreMandatoryFields: true });
                log.debug('Case Saved', 'Case ID: ' + CaseId);

                // Get Case Number
                let caseNumberValue = '';
                search.create({
                    type: 'supportcase',
                    filters: [['internalid', 'is', CaseId]],
                    columns: ['casenumber']
                }).run().each(function (result) {
                    caseNumberValue = result.getValue('casenumber');
                    return false;
                });

                let responseObj = {
                    code: 200,
                    status: "SUCCESS",
                    message: 'Case Created with ID of ' + CaseId + ' Case Number is: ' + caseNumberValue,
                    caseNumber: caseNumberValue
                };

                log.debug('Response', responseObj);
                context.response.write(JSON.stringify(responseObj));

            } catch (e) {
                log.error('Error', e);
                context.response.write(JSON.stringify({
                    code: 500,
                    status: "ERROR",
                    message: e.message || e
                }));
            }
        }

        return {
            onRequest: onRequest
        };

    });
