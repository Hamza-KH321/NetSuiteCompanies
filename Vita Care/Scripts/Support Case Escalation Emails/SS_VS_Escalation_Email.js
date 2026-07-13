/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @fileName SS || Case Escalation Emails
 */

define(['N/search', 'N/record', 'N/email', 'N/log', 'N/runtime', 'N/format'], function (search, record, email, log, runtime, format) {

    const CATEGORY_CONFIG = {
        '1': { hours: 2, recipients: [418633], names: ['E-147 Omar Nahhas'] }, // Printing Issues / مشاكل طباعة
        '2': { hours: 1.5, recipients: [418633], names: ['E-147 Omar Nahhas'] }, // Purchasing / المشتريات
        '3': { hours: 2, recipients: [418633], names: ['E-147 Omar Nahhas'] }, // Inventories / المخازن
        '4': { hours: 1.5, recipients: [418633], names: ['E-147 Omar Nahhas'] }, // POS / نظام نقاط البيع
        '6': { hours: 1.5, recipients: [418633, 228442], names: ['E-147 Omar Nahhas', 'E-77 Abdallah Al Daour'] }, // RASD / رصد
        '10': { hours: 1.5, recipients: [418633, 228442], names: ['E-147 Omar Nahhas', 'E-77 Abdallah Al Daour'] }, // Wasfaty / وصفتي
        '7': { hours: 2, recipients: [418633, 25], names: ['E-147 Omar Nahhas', 'E-8 Saleem Mohammed Al-Sousi'] }, // Accounting and Return / المحاسبة والمالية والاسترجاع
        '8': { hours: 2, recipients: [418633], names: ['E-147 Omar Nahhas'] }, // Sales Rep / مندوبي Vitacare
        '11': { hours: 0.5, recipients: [228442], names: ['E-77 Abdallah Al Daour'] }, // إدارة الصيدلية
        '12': { hours: 2, recipients: [418633, 228442], names: ['E-147 Omar Nahhas', 'E-77 Abdallah Al Daour'] }, // طلب جلسه تدريبية / New Training Session
        '15': { hours: 1.5, recipients: [418633, 228442], names: ['E-147 Omar Nahhas', 'E-77 Abdallah Al Daour'] }, // Zatca/زاتكا
        '17': { hours: 4, recipients: [253964], names: ['E-83 Mohammed Alnahaas'] }, // ربط جهاز الشبكه (جيديا)
        '18': { hours: 0.5, recipients: [228442], names: ['E-77 Abdallah Al Daour'] }, // WhatsApp
        '19': { hours: 48, recipients: [228442], names: ['E-77 Abdallah Al Daour'] }, // Consultation
        '22': { hours: 24, recipients: [5455], names: ['E-16 Oday Tayseer Othman'] }, // طلب كشف حساب/Statement of Account 
        '23': { hours: 24, recipients: [14374], names: ['E-22 Hatoon Ahmad Felemban'] }, // تقارير وصفتي الشهرية/ Wasfaty Monthly Reports

    };

    const CATEGORY_SUBCATEGORY_EXCEPTIONS = {
        '1|110': { hours: 0.5, recipients: [418633], names: ['E-147 Omar Nahhas'] }, // استفسارات تخص الطباعه والفواتير	
        '1|47': { hours: 48, recipients: [25], names: ['E-8 Saleem Mohammed Al-Sousi'] }, // Shipment delay / تأخرت طلبيتي الجديدة
        '1|48': { hours: 48, recipients: [25], names: ['E-8 Saleem Mohammed Al-Sousi'] }, // Shipment delay / تأخرت طلبيتي الجديدة
        '1|51': { hours: 72, recipients: [319304], names: ['E-96 Mustafa Elsadawy'] }, // Quotation request / طلب عرض سعر
        '1|51': { hours: 72, recipients: [83814], names: ['E-39 Mohammad Alhusami'] }, // Quotation request / طلب عرض سعر
        '2|108': { hours: 0.5, recipients: [418633], names: ['E-147 Omar Nahhas'] }, // استفسارات تخص المشتريات	
        '6|68': { hours: 72, recipients: [228442], names: ['E-77 Abdallah Al Daour'] }, // RASD isn't working / رصد لايعمل عند نقطة المبيعات
        '6|69': { hours: 72, recipients: [228442], names: ['E-77 Abdallah Al Daour'] }, // Dispatch / استقبال الطلبية من المورد
        '6|200': { hours: 0.5, recipients: [228442], names: ['E-77 Abdallah Al Daour'] }, // ربط رصد
        '10|199': { hours: 2, recipients: [418633], names: ['E-147 Omar Nahhas'] }, // Dispatch / استقبال الطلبية من المورد
        '10|186': { hours: 120, recipients: [228442], names: ['E-77 Abdallah Al Daour'] }, // Link Wasfaty / ربط وصفتي	
        '10|201': { hours: 168, recipients: [228442], names: ['E-77 Abdallah Al Daour'] }, // Wasfaty errors
        '10|202': { hours: 168, recipients: [228442], names: ['E-77 Abdallah Al Daour'] }, // ربط قائمه منتجات
        '7|77': { hours: 72, recipients: [25], names: ['E-8 Saleem Mohammed Al-Sousi'] }, // Return request + reason / طلب استرجاع + سبب الاسترجاع
        '8|79': { hours: 72, recipients: [418633], names: ['E-147 Omar Nahhas'] }, // Sales rep. didn't visit / لم تتم زيارتنا من قبل المندوبين
        '8|80': { hours: 72, recipients: [418633], names: ['E-147 Omar Nahhas'] }, // Complain on Vitacare member / شكوى على مندوب أو موظف (مع مساحه للشرح)
        '15|185': { hours: 72, recipients: [418633], names: ['E-147 Omar Nahhas'] }, // Others / مشاكل أخرى	
        '12|115': { hours: 168, recipients: [228442], names: ['E-77 Abdallah Al Daour'] }, // المحاسبه Accounting and Finance
        '12|204': { hours: 72, recipients: [228442], names: ['E-77 Abdallah Al Daour'] }, // رصد / Rasd
        '12|205': { hours: 72, recipients: [228442], names: ['E-77 Abdallah Al Daour'] }, // وصفتي / Wasfaty
        '4|206': { hours: 72, recipients: [228442], names: ['E-77 Abdallah Al Daour'] }, // اضافة او دمج نقاط لعميل الولاء	
        '18|208': { hours: 24, recipients: [228442], names: ['E-77 Abdallah Al Daour'] }, // ربط الواتس اب	

    };

    function execute(context) {
        try {
            var supportcaseSearchObj = search.create({
                type: "supportcase",
                filters:
                    [
                        ["status", "noneof", "1", "3", "5", "7"],
                        "AND",
                        ["custevent_vs_escalation_email_sent", "is", "F"],
                        "AND",
                        ["custevent_vs_status_change_datetime", "isnotempty", ""]
                    ],
                columns: [
                    "casenumber", "startdate", "assigned", "custevent2", "custevent3",
                    "status", "priority", "custevent_vs_status_change_datetime",
                    "company"
                ]
            });

            supportcaseSearchObj.run().each(function (result) {
                try {
                    var caseId = result.id;
                    var caseNumber = result.getValue("casenumber");
                    var statusChangeDateRaw = result.getValue("custevent_vs_status_change_datetime");
                    var caseCategory = result.getValue("custevent2");
                    var caseSubCategory = result.getValue("custevent3");
                    var caseSubCategoryText = result.getText("custevent3");
                    var assignedTo = result.getText("assigned");
                    var companyName = result.getText("company");
                    var incidentDateRaw = result.getValue("startdate");

                    log.debug("Processing Case", `ID: ${caseId}, Case #: ${caseNumber}, Category: ${caseCategory}, Subcategory: ${caseSubCategory}, Status Change Datetime: ${statusChangeDateRaw}`);

                    if (!statusChangeDateRaw) {
                        log.debug("Skipped", `Missing status change datetime for case #${caseNumber}`);
                        return true;
                    }

                    // Determine config (check for exception first)
                    var configKey = `${caseCategory}|${caseSubCategory}`;
                    var escalationConfig = CATEGORY_SUBCATEGORY_EXCEPTIONS[configKey] || CATEGORY_CONFIG[caseCategory];

                    if (!escalationConfig) {
                        log.debug("Skipped", `No escalation config found for case #${caseNumber}`);
                        return true;
                    }

                    var now = new Date();
                    var statusChangeTime = format.parse({
                        value: statusChangeDateRaw,
                        type: format.Type.DATETIME
                    });

                    var incidentDate = format.parse({
                        value: incidentDateRaw,
                        type: format.Type.DATETIME
                    });

                    var diffMs = now - statusChangeTime;
                    var diffHours = diffMs / (1000 * 60 * 60);

                    log.debug("Time Difference", `now: ${now}, statusChangeTime: ${statusChangeTime}, diffMs: ${diffMs}, diffHours: ${diffHours}`);

                    if (diffHours >= escalationConfig.hours) {
                        // Format email content
                        var subject = `Ticket escalation [${caseNumber}]`;
                        var body = `Dear Team,<br><br>` +
                            `Please note that ticket number <b>${caseNumber}</b> created on <b>${formatDateTime(incidentDate)}</b> ` +
                            `by <b>${companyName}</b> - CATEGORY <b>${caseCategory}</b> Subcategory <b>${caseSubCategoryText}</b> ` +
                            `assigned to <b>${assignedTo}</b> has exceeded the allowed time.<br><br>Thanks`;

                        // Send email
                        email.send({
                            author: 373455,
                            recipients: escalationConfig.recipients,
                            subject: subject,
                            body: body
                        });

                        log.audit('Email Sent', `Case #${caseNumber} escalated and email sent to: ${escalationConfig.names.join(', ')}`);

                        // Update the support case
                        record.submitFields({
                            type: record.Type.SUPPORT_CASE,
                            id: caseId,
                            values: {
                                status: '3', // Escalated
                                custevent_vs_escalation_email_sent: true,
                                custevent_vs_time_case_escalated: format.format({
                                    value: new Date(),
                                    type: format.Type.DATETIME
                                })
                            }
                        });

                        log.audit('Case Updated', `Case #${caseNumber} marked as escalated.`);
                    } else {
                        log.debug("No escalation needed", `Case #${caseNumber} is still within allowed time.`);
                    }

                } catch (caseErr) {
                    log.error('Error processing case', caseErr.toString());
                }

                return true;
            });

        } catch (e) {
            log.error("Script Execution Error", e.toString());
        }
    }

    function formatDateTime(rawDate) {
        try {
            var dateObj = new Date(rawDate);
            var day = ('0' + dateObj.getDate()).slice(-2);
            var month = ('0' + (dateObj.getMonth() + 1)).slice(-2);
            var year = dateObj.getFullYear();
            var hours = dateObj.getHours();
            var minutes = ('0' + dateObj.getMinutes()).slice(-2);
            var ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
        } catch (e) {
            return rawDate;
        }
    }

    return { execute };
});
