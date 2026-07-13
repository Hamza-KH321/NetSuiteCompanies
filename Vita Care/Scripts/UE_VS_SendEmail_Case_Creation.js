/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(["N/email", "N/record", "N/runtime", "N/url", "N/log", "N/search", 'N/https'], function (
    email, record, runtime, url, log, search, https
) {
    function afterSubmit(context) {
        if (context.type !== context.UserEventType.CREATE) {
            return;
        }
        try {
            var newRecord = context.newRecord;
            var recordType = newRecord.type;
            var recordId = newRecord.id;
            var newRecord = context.newRecord;
            var caseId = newRecord.id;
            var caseNumber = newRecord.getValue("casenumber");
            //var caseNumberText = newRecord.getText("casenumber");
            var title = newRecord.getValue("title");
            var form = newRecord.getValue("customform");
            var creatorEmail = newRecord.getValue("custevent_vs_creatoremail");
            // var creatorName = newRecord.getValue("custevent_vs_case_creator");

            var lookupFields = search.lookupFields({
                type: search.Type.SUPPORT_CASE,
                id: caseId,
                columns: ['assigned', 'custevent2', 'custevent3', 'company', 'casenumber', 'custevent_vs_case_creator']
            });

            var EmpIDValue = lookupFields.assigned && lookupFields.assigned.length > 0 ? lookupFields.assigned[0].value : null;
            var EmpIDText = lookupFields.assigned && lookupFields.assigned.length > 0 ? lookupFields.assigned[0].text : null;
            var categoryText = lookupFields.custevent2 && lookupFields.custevent2.length > 0 ? lookupFields.custevent2[0].text : null;
            var subCategoryText = lookupFields.custevent3 && lookupFields.custevent3.length > 0 ? lookupFields.custevent3[0].text : null;
            var companyText = lookupFields.company && lookupFields.company.length > 0 ? lookupFields.company[0].text : null;
            var caseNumberText = lookupFields.casenumber && lookupFields.casenumber.length > 0 ? lookupFields.casenumber[0].text : null;
            var creator = lookupFields.custevent_vs_case_creator && lookupFields.custevent_vs_case_creator.length > 0 ? lookupFields.custevent_vs_case_creator[0].value : null;
            var creatorName = lookupFields.custevent_vs_case_creator && lookupFields.custevent_vs_case_creator.length > 0 ? lookupFields.custevent_vs_case_creator[0].text : null;
            var loadedRecord = record.load({ type: recordType, id: recordId, isDynamic: true });
            var caseNumberTest = loadedRecord.getValue('casenumber');
            var customerPhone = newRecord.getValue("phone");
            var internalcategoryText = loadedRecord.getText("custevent_vs_internalcasecategory");
            var internalSubCategoryText = loadedRecord.getText("custevent_vs_internalcasesubcategory");
            var customerId = lookupFields.company && lookupFields.company.length > 0 ? lookupFields.company[0].value : null;
            var customerCode = "";

            var phoneTarget = null;

            log.debug("Field Lookup is:", EmpIDValue);
            log.debug("caseId is:", caseId);
            log.debug("caseNumber is:", caseNumber);
            log.debug("title is:", title);
            log.debug("company is:", companyText);
            log.debug("category is:", categoryText);
            log.debug("subCategory is:", subCategoryText);
            log.debug("caseNumberTest is:", caseNumberTest);



            log.debug("employeeEmail is:", employeeEmail);

            var caseUrl = url.resolveRecord({
                recordType: record.Type.SUPPORT_CASE,
                recordId: caseId,
                isEditMode: false,
            });

            var emailSubject = "";
            var emailBody = "";

            log.debug('emailSubject is', emailSubject);
            log.debug('emailBody is', emailBody);

            // var ccRecipients = [
            //   "Aya.Abuzaid@vitacareonline.com",
            //   "rahma.alrifai@vitacareonline.com",
            //   "bashar.khader@vitacareonline.com",
            //   "eman.ashour@vitacareonline.com",
            //   "khaled.aleadini@vitacareonline.com",
            //   "mohammad.nahhas@vitacareonline.com",
            //   "abdallah.daour@vitacareonline.com",
            //   "haya.alomari@vitacareonline.com",
            //   "ahmad.hasan@vitacareonline.com",
            // ];

            if (form != "313") {
                // Internal Case
                var employeeRecord = record.load({
                    type: record.Type.EMPLOYEE,
                    id: EmpIDValue,
                });
                var employeeEmail = employeeRecord.getValue("email");
                phoneTarget = customerPhone

                emailSubject = "Case: " + caseNumber + " : " + title;
                emailBody = "A new case has been created for " + companyText + "\n\n";
                emailBody += "Assigned To: " + EmpIDText + "\n\n";
                emailBody += "Category: " + categoryText + "\n\n";
                emailBody += "Sub Category: " + subCategoryText + "\n\n";
                emailBody += "Thanks.\n\n";
                emailBody += "View the case record: " + "https://7065838.app.netsuite.com/" + caseUrl;

                switch (EmpIDValue) {
                    case "345023":
                        // Haya alomari
                        email.send({
                            author: runtime.getCurrentUser().id,
                            recipients: employeeEmail,
                            //cc: ccRecipients,
                            subject: emailSubject,
                            body: emailBody,
                        });
                        log.debug('Email sent to Haya:', EmpIDValue);
                        break;
                    case "427576":
                        // Rahma Alrifai
                        email.send({
                            author: runtime.getCurrentUser().id,
                            recipients: employeeEmail,
                            //cc: ccRecipients,
                            subject: emailSubject,
                            body: emailBody,
                        });
                        log.debug('Email sent to Rahma:', EmpIDValue);
                        break;
                    case "427575":
                        // Eman ashour
                        email.send({
                            author: runtime.getCurrentUser().id,
                            recipients: employeeEmail,
                            //cc: ccRecipients,
                            subject: emailSubject,
                            body: emailBody,
                        });
                        log.debug('Email sent to Eman:', EmpIDValue);
                        break;
                    case "170175":
                        // Khaled aleadini
                        email.send({
                            author: runtime.getCurrentUser().id,
                            recipients: employeeEmail,
                            //cc: ccRecipients,
                            subject: emailSubject,
                            body: emailBody,
                        });
                        log.debug('Email sent to Khaled:', EmpIDValue);
                        break;
                    case "55093":
                        // Omar alsolby
                        email.send({
                            author: runtime.getCurrentUser().id,
                            recipients: employeeEmail,
                            //cc: ["saleem.alsousi@vitacareonline.com", "ahmad.hasan@vitacareonline.com"],
                            subject: emailSubject,
                            body: emailBody,
                        });
                        break;
                    case "4334":
                        // Mostafa Yakoub
                        email.send({
                            author: runtime.getCurrentUser().id,
                            recipients: employeeEmail,
                            //cc: ["omar.nahhas@vitacareonline.com", "ahmad.hasan@vitacareonline.com"],
                            subject: emailSubject,
                            body: emailBody,
                        });
                        log.debug('Email sent to Mostafa:', EmpIDValue);
                        break;
                    default:
                        log.debug('No matching employee found for EmpIDValue:', EmpIDValue);
                }
            }

            else {
                // Internal Case
                var employeeRecord = record.load({
                    type: record.Type.EMPLOYEE,
                    id: creator,
                });

                phoneTarget = employeeRecord.getValue("mobilephone");

                emailSubject = "تذكرة جديدة";
                emailBody = "";
                emailBody += '<div style="text-align: right;">';
                emailBody += creatorName + " عزيزي " + "<br><br>";
                emailBody += " تم إستلام طلب الدعم الخاص بكم   <br><br>";
                emailBody += "رقم التذكرة ";
                emailBody += caseNumberTest + "<br><br> ";
                emailBody += title + " عنوانها <br><br>";
                emailBody += "تم تحويل التذكرة على الموظف المختص وسيتم العمل على طلبكم في أقرب وقت ممكن. <br><br>";
                emailBody += "شكرا لك <br><br>";
                emailBody += '</div>';

                email.send({
                    author: runtime.getCurrentUser().id,
                    recipients: creatorEmail,
                    subject: emailSubject,
                    body: emailBody,
                });
                log.debug('Email sent to Creator because its internal case:', creatorEmail);

            }

            /**
             * Check "Send WhatsApp" on customer before sending
             */
            var sendWhatsAppEnabled = false;

            if (customerId) {
                try {
                    var custRec = record.load({ type: record.Type.CUSTOMER, id: customerId });
                    sendWhatsAppEnabled = custRec.getValue('custentity_vs_send_whatsapp');
                    log.debug('Send WhatsApp Enabled?', sendWhatsAppEnabled);
                    customerCode = custRec.getValue('nameorig');
                } catch (e) {
                    log.error('Failed to load customer record', e);
                }
            }

            // Send WhatsApp only if enabled
            if (sendWhatsAppEnabled) {
                sendWhatsApp(phoneTarget, EmpIDText || creatorName, caseNumberTest, caseId, categoryText, subCategoryText, internalcategoryText, internalSubCategoryText, customerCode);
            }
        } catch (error) {
            log.error("ERROR!!!", error);
        }
    }

    /**
            * Send WhatsApp via Arabot
            */
    function sendWhatsApp(phoneTarget, targetName, caseNumber, caseId, categoryText, subCategoryText, internalcategoryText, internalSubCategoryText, customerCode) {
        log.debug('Sending WhatsApp', {
            phoneTarget: phoneTarget,
            targetName: targetName,
            caseNumber: caseNumber,
            caseId: caseId
        });

        var token = runtime.getCurrentScript().getParameter({ name: 'custscript_arabot_integration_token2' });
        var campaignUrl = 'https://cmgr.arabot.io/campaigns/c18bdb91-3754-43fb-b247-4664da3ec213/append-targets';

        if (!phoneTarget) {
            log.debug('WhatsApp skipped', 'No phone number provided');
            return;
        }


        var payload = {
            "contacts": [
                {
                    "channel_id": phoneTarget,
                    "target_name": targetName,
                    "properties": {
                        "user_id": customerCode
                    }
                }
            ],
            "template_information": {
                "name": "ticket_created_reply",
                "language": {
                    "policy": "deterministic",
                    "code": "ar"
                },
                "parameters": [
                    caseNumber,
                    categoryText || internalcategoryText || "{{CATEGORY}}",
                    subCategoryText || internalSubCategoryText || "{{SUBCATEGORY}}"
                ],
                "header_parameters": [],
                "component_parameters": [],
                "carousel_parameters": []
            }
        };


        var response = https.post({
            url: campaignUrl,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-integration-token': token
            },
            body: JSON.stringify(payload)
        });

        log.debug('WhatsApp API Response', response.body);

        // Save response to Case record (WhatsApp subtab)
        var resJson = JSON.parse(response.body);
        var caseRec = record.load({ type: record.Type.SUPPORT_CASE, id: caseId });
        caseRec.setValue({ fieldId: 'custevent_close_whatsapp_response', value: JSON.stringify(resJson) });
        caseRec.setValue({ fieldId: 'custevent_close_whatsapp_requestbody', value: JSON.stringify(payload) });
        caseRec.save();
        log.audit('WhatsApp Sent', {
            phone: phoneTarget,
            targetName: targetName,
            caseNumber: caseNumber,
            caseId: caseId
        });
    }

    return {
        afterSubmit: afterSubmit,
    };
});
