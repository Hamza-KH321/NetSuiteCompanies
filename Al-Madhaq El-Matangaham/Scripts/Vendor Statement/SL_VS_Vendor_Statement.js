/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Vendor Statement
 */
define(['N/ui/serverWidget', 'N/search', 'N/log', 'N/render', 'N/file', 'N/format', 'N/url', 'N/record', 'N/runtime'],
    function (serverWidget, search, log, render, file, format, url, record, runtime) {

        function onRequest(context) {
            var form = serverWidget.createForm({ title: 'Vendor Statement Report' });

            var suiteletUrl = url.resolveScript({
                scriptId: 'customscript_vs_sl_vendor_statement',
                deploymentId: 'customdeploy_vs_sl_vendor_statement',
                returnExternalUrl: false
            });

            // Add a field group for better organization
            form.addFieldGroup({ id: 'filters_group', label: 'Report Filters' });
            form.addFieldGroup({ id: 'html_group', label: 'html_group' });

            // vendor Multi-select
            var entityField = form.addField({
                id: "account_name",
                type: serverWidget.FieldType.SELECT,
                label: "Vendor",
                source: "vendor",
                container: 'filters_group'
            });
            entityField.isMandatory = true;
            entityField.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.OUTSIDEABOVE });
            entityField.updateBreakType({ breakType: serverWidget.FieldBreakType.STARTCOL });

            // From Date
            var fromDateField = form.addField({
                id: 'custpage_fromdate',
                type: serverWidget.FieldType.DATE,
                label: 'From Date',
                container: 'filters_group'
            });
            fromDateField.isMandatory = true;
            fromDateField.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.STARTROW });

            // To Date
            var toDateField = form.addField({
                id: 'custpage_todate',
                type: serverWidget.FieldType.DATE,
                label: 'To Date',
                container: 'filters_group'
            });
            toDateField.isMandatory = true;
            toDateField.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.MIDROW });

            var locationField = form.addField({
                id: 'custpage_location',
                type: serverWidget.FieldType.SELECT,
                source: 'location',
                label: 'Location',
                container: 'filters_group'
            });
            locationField.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.MIDROW });

            // Subsidiary
            var subsidiary = form.addField({
                id: 'custpage_subsidiary',
                type: serverWidget.FieldType.SELECT,
                source: 'subsidiary',
                label: 'Subsidiary',
                container: 'filters_group'
            });
            subsidiary.isMandatory = true;
            subsidiary.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.MIDROW });

            // Hidden Template Field
            var template = form.addField({
                id: 'custpage_template',
                type: serverWidget.FieldType.SELECT,
                label: 'Template',
                container: 'filters_group'

            });
            template.isMandatory = true;

            template.addSelectOption({ value: 'PDF', text: 'PDF' });
            template.addSelectOption({ value: 'CSV', text: 'CSV' });
            template.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.ENDROW });

            // Add Action Button
            form.addButton({
                id: 'custpage_open_pdf',
                label: 'Open Vendor Statement',
                functionName: 'openVendorStatement'
            });

            // --------------------------
            // Set Default Values
            // --------------------------
            var today = new Date();
            var firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            var formattedToday = format.format({
                value: today,
                type: format.Type.DATE
            });

            var formattedFirstDay = format.format({
                value: firstDayOfMonth,
                type: format.Type.DATE
            });

            fromDateField.defaultValue = formattedFirstDay;
            toDateField.defaultValue = formattedToday;

            var userSubsidiary = runtime.getCurrentUser().subsidiary;
            if (userSubsidiary) {
                subsidiary.defaultValue = userSubsidiary;
            }

            // Optional: Preselect default vendors by internal ID (array of strings)
            entityField.defaultValue = []; // Example: ['1001', '1002']
            form.addField({
                id: 'custpage_script_pdf',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Script',
            }).defaultValue = `
            <script type="text/javascript">
                function openVendorStatement() {
                    var vendors = getFieldValues("account_name", true);
                    var from = getFieldValues("custpage_fromdate");
                    var to = getFieldValues("custpage_todate");
                    var location = getFieldValues("custpage_location");
                    var subsidiary = getFieldValues("custpage_subsidiary");
                    var template = getFieldValues("custpage_template");
            
                    var missingFields = [];
                    if (!vendors.length) missingFields.push("Vendor");
                    if (!from) missingFields.push("From Date");
                    if (!to) missingFields.push("To Date");
                    if (!subsidiary) missingFields.push("Subsidiary");
            
                    if (missingFields.length > 0) {
                        alert("Please fill the following fields:\\n" + missingFields.join("\\n"));
                        return;
                    }
            
                    vendors.forEach(function(vendor) {
                        var form = document.createElement("form");
                        form.method = "POST";
                        form.target = "_blank";
                        form.action = "${suiteletUrl}";
            
                        createAndAppendInput(form, "custpage_template", template);
                        createAndAppendInput(form, "account_name", vendor);
                        createAndAppendInput(form, "custpage_fromdate", from);
                        createAndAppendInput(form, "custpage_todate", to);
                        createAndAppendInput(form, "custpage_location", location);
                        createAndAppendInput(form, "custpage_subsidiary", subsidiary);
            
                        document.body.appendChild(form);
                        form.submit();
                    });
                }
            
                function createAndAppendInput(form, name, value) {
                    var input = document.createElement("input");
                    input.type = "hidden";
                    input.name = name;
                    input.value = value;
                    form.appendChild(input);
                }
            
                function getFieldValues(fieldName, isMultiSelect) {
                    var elems = document.getElementsByName(fieldName);
                    if (elems.length === 0) return isMultiSelect ? [] : "";
            
                    var value = elems[0].value;
                    if (isMultiSelect) {
                        var splitValues = value ? value.split(String.fromCharCode(5)) : [];
                        return splitValues;
                    } else {
                        return value;
                    }
                }
            </script>
            `;

            if (context.request.method === 'GET') {
                context.response.writePage(form);
            } else if (context.request.method === 'POST') {
                try {
                    var template = context.request.parameters.custpage_template;
                    if (template === 'PDF') {
                        renderPDF(context);
                    } else if (template === 'CSV') {
                        renderCSV(context);
                    }
                } catch (error) {
                    log.error('POST error', error);
                    context.response.write("Error generating report: " + error.message);
                }
            }
            logUsage(context, 'suitelet finished ');

        }

        function renderCSV(context) {

            var request = context.request;

            var fromDate = request.parameters.custpage_fromdate;
            var toDate = request.parameters.custpage_todate;
            var location = request.parameters.custpage_location;
            var subsidiaryId = request.parameters.custpage_subsidiary;
            var vendorId = request.parameters.account_name;

            var subsidiaryInfo = getSubsidiaryInfo(subsidiaryId);
            var vendorInfo = getEntityInfo(vendorId);

            var vendorData = fetchVendorTransactions(fromDate, toDate, location, subsidiaryId, vendorId);
            // vendorData = { openingBalance, transactions[], totalSummary }

            /* ================= HELPERS ================= */

            function escapeHtml(val) {
                return val ? String(val)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;') : '';
            }

            function formatNumber(val) {
                if (val === null || val === undefined || isNaN(val)) return '0.00';
                return Number(val).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }

            /* ================= OPENING BALANCE ================= */

            var openingDebit = vendorData.openingBalance.balance > 0
                ? formatNumber(vendorData.openingBalance.balance)
                : '0.00';

            var openingCredit = vendorData.openingBalance.balance < 0
                ? formatNumber(Math.abs(vendorData.openingBalance.balance))
                : '0.00';

            /* ================= BUILD HTML ================= */

            var html = `
<html>
<head>
<meta charset="UTF-8">
	<style type="text/css">* { <#if .locale == "zh_CN"> font-family: NotoSans, NotoSansCJKsc, sans-serif; <#elseif .locale == "zh_TW">
			font-family: NotoSans, NotoSansCJKtc, sans-serif; <#elseif .locale == "ja_JP"> font-family: NotoSans,
			NotoSansCJKjp, sans-serif; <#elseif .locale == "ko_KR"> font-family: NotoSans, NotoSansCJKkr, sans-serif; <#elseif .locale == "th_TH">
			font-family: NotoSans, NotoSansThai, sans-serif; <#else>
				font-family: NotoSansArabic, NotoSans, sans-serif;
			</#if> } span.title { font-size:
			28pt; } span.number { font-size: 16pt; } table.main td, th { border-bottom: 1px solid
			#ddd; } td.empty { border: none; } th { font-weight: bold; vertical-align: middle;
			padding: 5px 6px 3px; background-color: #e3e3e3; color: #333333; } td { padding: 4px
			6px; } td p { align:left } 		</style>
</head>
<body>

<table style="width:100%; border-collapse:collapse;">
<tr>
<td style="width:50%; vertical-align:top;">
    <table style="width:100%;">
        <tr><td><b>Company Name:</b></td><td>${escapeHtml(subsidiaryInfo.name)}</td></tr>
        <tr><td><b>Subsidiary:</b></td><td>${escapeHtml(subsidiaryInfo.name)}</td></tr>
        <tr><td><b>Company TRN:</b></td><td>${escapeHtml(subsidiaryInfo.vatregnumber)}</td></tr>
        <tr><td><b>Address:</b></td><td>${escapeHtml(subsidiaryInfo.mainaddress_text)}</td></tr>
    </table>
</td>

<td style="width:50%; vertical-align:top;">
    <table style="width:100%;">
        <tr><td><b>Supplier Name:</b></td><td>${escapeHtml(vendorInfo.companyname)}</td></tr>
        <tr><td><b>Supplier TRN:</b></td><td>${escapeHtml(vendorInfo.vatregnumber)}</td></tr>
        <tr><td><b>Statement Period:</b></td><td>From ${fromDate} To ${toDate}</td></tr>
        <tr><td><b>Currency:</b></td><td>${vendorInfo.currency}</td></tr>
        <tr><td><b>Generated On:</b></td><td>${new Date().toLocaleDateString()}</td></tr>
    </table>
</td>
</tr>
</table>

<h3>Opening Balance</h3>
<table style="width:100%; border:1px solid #000;">
<tr style="background:#c0c0c0;">
<td><b>Opening Balance at ${fromDate}</b></td>
<td></td>
</tr>
<tr>
<td>Debit Balance</td>
<td style="text-align:right;">${openingDebit}</td>
</tr>
<tr>
<td>Credit Balance</td>
<td style="text-align:right;">${openingCredit}</td>
</tr>
</table>

<h3>Transactions</h3>
<table style="width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid black; font-size: 10pt;">
<thead>
<tr>
<th style="padding: 6px 4px; text-align: left; border: 1px solid black;">#</th>
<th style="padding: 6px 4px; text-align: left; border: 1px solid black;">Date</th>
<th style="padding: 6px 4px; text-align: left; border: 1px solid black;">Document Type</th>
<th style="padding: 6px 4px; text-align: left; border: 1px solid black;">Document No</th>
<th style="padding: 6px 4px; text-align: left; border: 1px solid black;">Supplier Ref</th>
<th style="padding: 6px 4px; text-align: left; border: 1px solid black;">Description</th>
<th style="padding: 6px 4px; text-align: left; border: 1px solid black;">Due Date</th>
<th style="padding: 6px 4px; text-align: left; border: 1px solid black;">Debit</th>
<th style="padding: 6px 4px; text-align: left; border: 1px solid black;">Credit</th>
<th style="padding: 6px 4px; text-align: left; border: 1px solid black;">Balance</th>
</tr>
</thead>
<tbody>
`;

            vendorData.transactions.forEach(function (t, i) {
                html += `
<tr>
<td style="padding: 5px 4px; text-align: left; border: 1px solid black;">${i + 1}</td>
<td style="padding: 5px 4px; text-align: left; border: 1px solid black;">${escapeHtml(t.date)}</td>
<td style="padding: 5px 4px; text-align: left; border: 1px solid black;">${escapeHtml(t.type)}</td>
<td style="padding: 5px 4px; text-align: left; border: 1px solid black;">${escapeHtml(t.tranid)}</td>
<td style="padding: 5px 4px; text-align: left; border: 1px solid black;">${escapeHtml(t.transactionNumber)}</td>
<td style="padding: 5px 4px; text-align: left; border: 1px solid black;" >${escapeHtml(t.memo)}</td>
<td style="padding: 5px 4px; text-align: left; border: 1px solid black;">${escapeHtml(t.dueDate)}</td>
<td style="padding: 5px 4px; text-align: left; border: 1px solid black;" >${formatNumber(t.debit)}</td>
<td style="padding: 5px 4px; text-align: left; border: 1px solid black;" >${formatNumber(t.credit)}</td>
<td style="padding: 5px 4px; text-align: left; border: 1px solid black;">${formatNumber(t.balance)}</td>
</tr>`;
            });

            html += `
</tbody>
</table>

<h3>Summary</h3>
<table style="width:100%; border:1px solid #000;">
<tr><td>Total Supplier Invoices</td><td style="text-align:right;">${formatNumber(vendorData.totalSummary.totalBills)}</td></tr>
<tr><td>Total Credit Notes</td><td style="text-align:right;">${formatNumber(vendorData.totalSummary.totalBillCredits)}</td></tr>
<tr><td>Total Payments Made</td><td style="text-align:right;">${formatNumber(vendorData.totalSummary.totalPayments)}</td></tr>
<tr style="background:#c0c0c0;">
<td><b>Closing Balance</b></td>
<td style="text-align:right;"><b>${formatNumber(vendorData.totalSummary.closingBalance)}</b></td>
</tr>
</table>

</body>
</html>
`;

            /* ================= WRITE FILE ================= */

            var excelFile = file.create({
                name: `Vendor_Statement_${vendorId}_${fromDate}_to_${toDate}.xls`,
                fileType: file.Type.PLAINTEXT,
                contents: html
            });

            context.response.writeFile({ file: excelFile });
        }


        function renderPDF(context) {
            var fromDate = context.request.parameters.custpage_fromdate;
            var toDate = context.request.parameters.custpage_todate;
            var location = context.request.parameters.custpage_location;
            var subsidiaryId = context.request.parameters.custpage_subsidiary;
            var subsidiaryInfo = getSubsidiaryInfo(subsidiaryId);

            var vendorId = context.request.parameters.account_name;
            var vendorInfo = getEntityInfo(vendorId);

            var vendorData = fetchVendorTransactions(fromDate, toDate, location, subsidiaryId, vendorId);

            var vendorStatementData = {
                subsidiary: subsidiaryInfo,
                vendorInfo: vendorInfo,
                fromDate: fromDate,
                toDate: toDate,
                transactions: vendorData.transactions,
                openingBalance: vendorData.openingBalance,
                totalSummary: vendorData.totalSummary,

                printDate: getFormattedDateTime(),

            };
            log.debug("vendorStatementData", vendorStatementData);
            var templateFile = file.load({ id: "VendorStatement/VendorStatement.xml" });
            var renderer = render.create();
            renderer.templateContent = templateFile.getContents();
            renderer.addCustomDataSource({
                format: render.DataSource.OBJECT,
                alias: "vendorStatementData",
                data: vendorStatementData,
            });

            context.response.renderPdf({ xmlString: renderer.renderAsString() });
        }


        function fetchVendorTransactions(fromDate, toDate, location, subsidiary, nameId) {
            log.debug('fetch transaction parms', {
                fromDate: fromDate,
                toDate: toDate,
                location: location,
                subsidiary: subsidiary,
                nameId: nameId
            })

            /* =========================================================
             * INIT DATA STRUCTURE
             * ========================================================= */
            var data = {
                vendorName: nameId,
                openingBalance: {
                    debit: 0,
                    credit: 0,
                    balance: 0
                },
                totalSummary: {
                    totalBills: 0,
                    totalPayments: 0,
                    totalBillCredits: 0,
                    closingBalance: 0
                },
                transactions: []
            };
            var openingFilters = [
                ["posting", "is", "T"],
                "AND",
                ["trandate", "before", fromDate],
                "AND",
                ["subsidiary", "anyof", subsidiary],
                "AND",
                ["name", "anyof", nameId],
                "AND",
                ["accounttype", "anyof", "AcctPay"],
                "AND",
                ["taxline", "is", "F"]
            ]

            if (location) {
                openingFilters.push("AND", ["location", "anyof", location]);
            }

            /* =========================================================
             * 1️⃣ OPENING BALANCE (BEFORE FROM DATE)
             * ========================================================= */
            var openingBalanceSearch = search.create({
                type: "transaction",
                filters: openingFilters,
                columns: [
                    search.createColumn({
                        name: "debitamount",
                        summary: "SUM"
                    }),
                    search.createColumn({
                        name: "creditamount",
                        summary: "SUM"
                    })
                ]
            });

            var openingResult = openingBalanceSearch.run().getRange({ start: 0, end: 1 });

            if (openingResult && openingResult.length > 0) {
                var openingDebit = parseFloat(
                    openingResult[0].getValue({ name: "debitamount", summary: "SUM" })
                ) || 0;

                var openingCredit = parseFloat(
                    openingResult[0].getValue({ name: "creditamount", summary: "SUM" })
                ) || 0;

                data.openingBalance.debit = openingDebit;
                data.openingBalance.credit = openingCredit;
                data.openingBalance.balance = openingDebit - openingCredit;
            }

            /* =========================================================
             * 2️⃣ ADD OPENING BALANCE ROW
             * ========================================================= */
            data.transactions.push({
                date: fromDate,
                type: "Opening Balance",
                memo: "Opening Balance",
                entity: "",
                documentId: "",
                debit: data.openingBalance.balance.toFixed(2) > 0 ? data.openingBalance.balance.toFixed(2) : "",
                credit: data.openingBalance.balance.toFixed(2) < 0 ? data.openingBalance.balance.toFixed(2) : "",
                balance: data.openingBalance.balance.toFixed(2)
            });

            /* =========================================================
             * 3️⃣ TRANSACTIONS WITHIN DATE RANGE
             * ========================================================= */

            var transactionFilters = [
                ["posting", "is", "T"],
                "AND",
                ["trandate", "within", fromDate, toDate],
                "AND",
                ["subsidiary", "anyof", subsidiary],
                "AND",
                ["name", "anyof", nameId],
                "AND",
                ["accounttype", "anyof", "AcctPay"],
                "AND",
                ["taxline", "is", "F"]
            ];
            if (location) {
                transactionFilters.push("AND", ["location", "anyof", location]);
            }
            var transactionSearch = search.create({
                type: "transaction",
                filters: transactionFilters,
                columns: [
                    search.createColumn({ name: "trandate", sort: search.Sort.ASC }),
                    "location",
                    "type",
                    "memo",
                    "entity",
                    "tranid",
                    "transactionnumber",
                    "debitamount",
                    "creditamount",
                    "duedate",
                    "currency",
                    "otherrefnum",
                ]
            });

            var runningBalance = data.openingBalance.balance;
            var totalDebit = 0;
            var totalCredit = 0;

            transactionSearch.run().each(function (result) {
                var typeText = result.getText("type");
                log.debug('Processing transaction', '' + typeText);

                var debit = result.getValue("debitamount");
                var credit = result.getValue("creditamount");

                debit = debit ? parseFloat(debit) : 0;
                credit = credit ? parseFloat(credit) : 0;

                totalDebit += debit;
                totalCredit += credit;

                runningBalance += debit;
                runningBalance -= credit;

                /* ================= TOTAL SUMMARY BY TYPE ================= */

                if (typeText == "Bill") {
                    data.totalSummary.totalBills += debit ? debit : credit;
                }

                if (typeText == "Bill Payment") {
                    data.totalSummary.totalPayments += debit ? debit : credit;
                }

                if (typeText == "Bill Credit") {
                    data.totalSummary.totalBillCredits += debit ? debit : credit;
                }
                data.totalSummary.closingBalance = runningBalance;
                /* ================= PUSH TRANSACTION ================= */

                data.transactions.push({
                    date: result.getValue("trandate"),
                    dueDate: result.getValue("duedate"),
                    type: result.getText("type"),
                    memo: result.getValue("memo"),
                    entity: result.getText("entity"),
                    tranid: result.getValue("tranid"),
                    transactionNumber: result.getValue("transactionnumber"),
                    location: result.getText("location"),
                    debit: debit ? debit.toFixed(2) : "",
                    credit: credit ? credit.toFixed(2) : "",
                    balance: runningBalance.toFixed(2)
                });

                return true;
            });

            /* =========================================================
             * 4️⃣ TOTAL ROW
             * ========================================================= */
            data.transactions.push({
                date: "",
                type: "Total",
                memo: "",
                entity: "",
                documentId: "",
                debit: totalDebit ? totalDebit.toFixed(2) : "",
                credit: totalCredit ? totalCredit.toFixed(2) : "",
                balance: runningBalance.toFixed(2)
            });

            return data;
        }

        function getFormattedDateTime() {
            var currentDate = new Date();
            log.debug('currentDate ', currentDate);

            // currentDate.setHours(currentDate.getHours() + 11);
            currentDate.setHours(currentDate.getHours() + 3);

            //  return year + '-' + month + '-' + day + ' - ' + hours + ':' + minutes + ':' + seconds;
            return currentDate
        }

        function getSubsidiaryInfo(subsidiaryId) {
            var companyId = runtime.accountId || "unknown";

            //if sandbox account,  replace _SB1 to -sb1
            if (companyId.indexOf('_SB') !== -1) {
                companyId = companyId.replace('_SB', '-sb');
            }

            if (!subsidiaryId) {
                return {
                    name: "Unknown Subsidiary",
                    logoUrl: null
                };
            }

            try {
                var subsidiaryRec = record.load({
                    type: record.Type.SUBSIDIARY,
                    id: subsidiaryId,
                    isDynamic: false
                });

                var name = subsidiaryRec.getValue({ fieldId: 'name' });
                var vatregnumber = subsidiaryRec.getValue({ fieldId: 'federalidnumber' });
                var mainaddress_text = subsidiaryRec.getValue({ fieldId: 'mainaddress_text' });
                var logoFileId = subsidiaryRec.getValue({ fieldId: 'logo' });
                var logoUrl = null;

                if (logoFileId) {
                    var logoFile = file.load({ id: logoFileId });
                    var relativeUrl = logoFile.url;
                    // Construct full logo URL with company ID
                    logoUrl = 'https://' + companyId + '.app.netsuite.com' + relativeUrl;
                }

                return {
                    name: name || "Unknown Subsidiary",
                    vatregnumber: vatregnumber || "",
                    mainaddress_text: mainaddress_text || "",
                    logoUrl: logoUrl,

                };

            } catch (e) {
                log.error("Error loading subsidiary info", e);
                return {
                    name: "Unknown Subsidiary",
                    logoUrl: null
                };
            }
        }


        function getEntityInfo(entityId) {
            if (!entityId) return { entityid: "Unknown", companyname: "", email: "", phone: "", currency: "" };

            var entitySearch = search.create({
                type: 'vendor',
                filters: [["internalid", "is", entityId]],
                columns: [
                    "entityid",
                    "companyname",
                    "email",
                    "phone",
                    "currency",
                    "vatregnumber"
                ],
            });

            var result = entitySearch.run().getRange({ start: 0, end: 1 });

            if (result.length > 0) {
                return {
                    entityid: result[0].getValue("entityid"),
                    companyname: result[0].getValue("companyname"),
                    email: result[0].getValue("email"),
                    phone: result[0].getValue("phone"),
                    currency: result[0].getText("currency"),
                    vatregnumber: result[0].getValue("vatregnumber")
                };
            } else {
                return { entityid: "Unknown", companyname: "", email: "", phone: "", currency: "" };
            }
        }

        function logUsage(context, message) {
            var remainingUsage = runtime.getCurrentScript().getRemainingUsage();
            log.audit(message, 'Remaining governance units: ' + remainingUsage);
        }


        return {
            onRequest: onRequest,
        };
    });
