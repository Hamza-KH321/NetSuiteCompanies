/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Employee Statement
 */
define(['N/ui/serverWidget', 'N/search', 'N/log', 'N/render', 'N/file', 'N/format', 'N/url', 'N/record', 'N/runtime'],
    function (serverWidget, search, log, render, file, format, url, record, runtime) {

        function onRequest(context) {
            var form = serverWidget.createForm({ title: 'Employee Statement Report' });

            var suiteletUrl = url.resolveScript({
                scriptId: 'customscript_vs_sl_employee_statement',
                deploymentId: 'customdeploy_vs_sl_employee_statement',
                returnExternalUrl: false
            });

            // Field Groups
            form.addFieldGroup({ id: 'filters_group', label: 'Report Filters' });
            form.addFieldGroup({ id: 'html_group', label: 'html_group' });

            // Employee Select
            var entityField = form.addField({
                id: 'account_name',
                type: serverWidget.FieldType.SELECT,
                label: 'Employee',
                source: 'employee',
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

            // Accounts Multi Select
            var accountsField = form.addField({
                id: 'custpage_accounts',
                type: serverWidget.FieldType.MULTISELECT,
                label: 'Accounts',
                container: 'filters_group'
            });

            accountsField.isMandatory = true;
            accountsField.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.MIDROW });

            // Load Accounts
            try {

                var accountSearch = search.create({
                    type: search.Type.ACCOUNT,
                    filters: [
                        ["isinactive", "is", "F"],
                        "AND",
                        ["internalid", "anyof", ["636", "637"]]
                    ],
                    columns: [
                        search.createColumn({ name: "displayname", sort: search.Sort.ASC })
                    ]
                });

                accountSearch.run().each(function (result) {

                    accountsField.addSelectOption({
                        value: result.id,
                        text: result.getValue("displayname")
                    });

                    return true;
                });

                // Default Values
                accountsField.defaultValue = ['636', '637'];

            } catch (e) {

                log.error('accountsField Error', e);
            }

            // Template (PDF / CSV)
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

            // Action Button
            form.addButton({
                id: 'custpage_open_pdf',
                label: 'Open Employee Statement',
                functionName: 'openEmployeeStatement'
            });

            // --------------------------
            // Set Default Values
            // --------------------------
            var today = new Date();
            var firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            fromDateField.defaultValue = format.format({ value: firstDayOfMonth, type: format.Type.DATE });
            toDateField.defaultValue = format.format({ value: today, type: format.Type.DATE });

            var userSubsidiary = runtime.getCurrentUser().subsidiary;
            if (userSubsidiary) {
                subsidiary.defaultValue = userSubsidiary;
            }

            entityField.defaultValue = [];

            // Inline JS
            form.addField({
                id: 'custpage_script_pdf',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Script',
            }).defaultValue = `
            <script type="text/javascript">
                function openEmployeeStatement() {
                    var employees = getFieldValues("account_name", true);
                    var from = getFieldValues("custpage_fromdate");
                    var to = getFieldValues("custpage_todate");
                    var subsidiary = getFieldValues("custpage_subsidiary");
                    var template = getFieldValues("custpage_template");
                    var accounts = getFieldValues("custpage_accounts", true);

                    var missingFields = [];
                    if (!employees.length) missingFields.push("Employee");
                    if (!from) missingFields.push("From Date");
                    if (!to) missingFields.push("To Date");
                    if (!subsidiary) missingFields.push("Subsidiary");
                    if (!accounts.length) missingFields.push("Accounts");

                    if (missingFields.length > 0) {
                        alert("Please fill the following fields:\\n" + missingFields.join("\\n"));
                        return;
                    }

                    employees.forEach(function(employee) {
                        var form = document.createElement("form");
                        form.method = "POST";
                        form.target = "_blank";
                        form.action = "${suiteletUrl}";

                        createAndAppendInput(form, "custpage_template", template);
                        createAndAppendInput(form, "account_name", employee);
                        createAndAppendInput(form, "custpage_fromdate", from);
                        createAndAppendInput(form, "custpage_todate", to);
                        createAndAppendInput(form, "custpage_subsidiary", subsidiary);
                        createAndAppendInput(form, "custpage_accounts", accounts.join(String.fromCharCode(5)));

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

            logUsage(context, 'suitelet finished');
        }

        // ============================================================
        //  CSV / XLS OUTPUT
        // ============================================================
        function renderCSV(context) {
            var request = context.request;
            var fromDate = request.parameters.custpage_fromdate;
            var toDate = request.parameters.custpage_todate;
            var subsidiaryId = request.parameters.custpage_subsidiary;
            var employeeId = request.parameters.account_name;

            var subsidiaryInfo = getSubsidiaryInfo(subsidiaryId);
            var employeeInfo = getEmployeeInfo(employeeId);
            var accounts = request.parameters.custpage_accounts
                ? request.parameters.custpage_accounts.split(String.fromCharCode(5))
                : [];

            log.debug('CSV accounts', accounts);

            var employeeData = fetchEmployeeTransactions(
                fromDate,
                toDate,
                subsidiaryId,
                employeeId,
                accounts
            );

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

            var openingDebit = formatNumber(employeeData.openingBalance.debit);
            var openingCredit = formatNumber(employeeData.openingBalance.credit);
            var totalDebit = formatNumber(employeeData.openingBalance.debit + employeeData.totalSummary.totalDebits);
            var totalCredit = formatNumber(employeeData.openingBalance.credit + employeeData.totalSummary.totalCredits);
            var closingBalance = formatNumber(employeeData.totalSummary.closingBalance);

            var html = `
<html>
<head>
<meta charset="UTF-8">
    <style type="text/css">
        * { font-family: NotoSansArabic, NotoSans, sans-serif; }
        span.title { font-size: 28pt; }
        table.main td, th { border-bottom: 1px solid #ddd; }
        td.empty { border: none; }
        th { font-weight: bold; vertical-align: middle; padding: 5px 6px 3px; background-color: #e3e3e3; color: #333333; }
        td { padding: 4px 6px; }
    </style>
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
        <tr><td><b>Employee Name:</b></td><td>${escapeHtml(employeeInfo.fullname)}</td></tr>
        <tr><td><b>Employee ID:</b></td><td>${escapeHtml(employeeInfo.entityid)}</td></tr>
        <tr><td><b>Department:</b></td><td>${escapeHtml(employeeInfo.department)}</td></tr>
        <tr><td><b>Statement Period:</b></td><td>From ${fromDate} To ${toDate}</td></tr>
        <tr><td><b>Generated On:</b></td><td>${new Date().toLocaleDateString()}</td></tr>
    </table>
</td>
</tr>
</table>

<h3>Transactions</h3>
<table style="width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid black; font-size: 10pt;">
<thead>
<tr>
    <th style="padding: 6px 4px; text-align: left; border: 1px solid black;">#</th>
    <th style="padding: 6px 4px; text-align: left; border: 1px solid black;">Date</th>
    <th style="padding: 6px 4px; text-align: left; border: 1px solid black;">Tran ID</th>
    <th style="padding: 6px 4px; text-align: left; border: 1px solid black;">Account</th>
    <th style="padding: 6px 4px; text-align: left; border: 1px solid black;">Account Type</th>
    <th style="padding: 6px 4px; text-align: left; border: 1px solid black;">Memo</th>
    <th style="padding: 6px 4px; text-align: right; border: 1px solid black;">Debit</th>
    <th style="padding: 6px 4px; text-align: right; border: 1px solid black;">Credit</th>
</tr>
</thead>
<tbody>
<!-- Opening Balance Row -->
<tr style="background-color: #f5f5f5; font-weight: bold;">
    <td style="padding: 5px 4px; text-align: center; border: 1px solid black;"></td>
    <td style="padding: 5px 4px; text-align: left; border: 1px solid black;">${escapeHtml(fromDate)}</td>
    <td colspan="4" style="padding: 5px 4px; text-align: left; border: 1px solid black;"><b>Opening Balance</b></td>
    <td style="padding: 5px 4px; text-align: right; border: 1px solid black;">${openingDebit}</td>
    <td style="padding: 5px 4px; text-align: right; border: 1px solid black;">${openingCredit}</td>
</tr>
`;

            employeeData.transactions.forEach(function (t, i) {
                html += `
<tr>
    <td style="padding: 5px 4px; text-align: center; border: 1px solid black;">${i + 1}</td>
    <td style="padding: 5px 4px; text-align: left; border: 1px solid black;">${escapeHtml(t.date)}</td>
    <td style="padding: 5px 4px; text-align: left; border: 1px solid black;">${escapeHtml(t.documentNumber)}</td>
    <td style="padding: 5px 4px; text-align: left; border: 1px solid black;">${escapeHtml(t.account)}</td>
    <td style="padding: 5px 4px; text-align: left; border: 1px solid black;">${escapeHtml(t.accountType)}</td>
    <td style="padding: 5px 4px; text-align: left; border: 1px solid black;">${escapeHtml(t.memo)}</td>
    <td style="padding: 5px 4px; text-align: right; border: 1px solid black;">${formatNumber(t.debit)}</td>
    <td style="padding: 5px 4px; text-align: right; border: 1px solid black;">${formatNumber(t.credit)}</td>
</tr>`;
            });

            html += `
</tbody>
<tfoot>
<tr style="background-color: #e3e3e3; font-weight: bold;">
    <td colspan="6" style="padding: 8px 4px; text-align: right; border: 1px solid black;">Total</td>
    <td style="padding: 8px 4px; text-align: right; border: 1px solid black;">${totalDebit}</td>
    <td style="padding: 8px 4px; text-align: right; border: 1px solid black;">${totalCredit}</td>
</tr>
<tr style="font-weight: bold;">
    <td colspan="6" style="padding: 8px 4px; text-align: right; border: 1px solid black;">Closing Balance</td>
    <td colspan="2" style="padding: 8px 4px; text-align: right; border: 1px solid black;">${closingBalance}</td>
</tr>
</tfoot>
</table>
</body>
</html>
`;
            var excelFile = file.create({
                name: `Employee_Statement_${employeeId}_${fromDate}_to_${toDate}.xls`,
                fileType: file.Type.PLAINTEXT,
                contents: html
            });

            context.response.writeFile({ file: excelFile });
        }

        // ============================================================
        //  PDF OUTPUT
        // ============================================================
        function renderPDF(context) {
            var fromDate = context.request.parameters.custpage_fromdate;
            var toDate = context.request.parameters.custpage_todate;
            var subsidiaryId = context.request.parameters.custpage_subsidiary;
            var employeeId = context.request.parameters.account_name;

            var subsidiaryInfo = getSubsidiaryInfo(subsidiaryId);
            var employeeInfo = getEmployeeInfo(employeeId);
            var accounts = context.request.parameters.custpage_accounts
                ? context.request.parameters.custpage_accounts.split(String.fromCharCode(5))
                : [];

            log.debug('PDF accounts', accounts);

            var employeeData = fetchEmployeeTransactions(
                fromDate,
                toDate,
                subsidiaryId,
                employeeId,
                accounts
            );

            var employeeStatementData = {
                subsidiary: subsidiaryInfo,
                employeeInfo: employeeInfo,
                fromDate: fromDate,
                toDate: toDate,
                transactions: employeeData.transactions,
                openingBalance: employeeData.openingBalance,
                totalSummary: employeeData.totalSummary,
                printDate: getFormattedDateTime()
            };

            log.debug("employeeStatementData", employeeStatementData);

            var templateFile = file.load({ id: "EmployeeStatementXML/EmployeeStatement.xml" });
            var renderer = render.create();
            renderer.templateContent = templateFile.getContents();
            renderer.addCustomDataSource({
                format: render.DataSource.OBJECT,
                alias: "employeeStatementData",
                data: employeeStatementData
            });

            context.response.renderPdf({ xmlString: renderer.renderAsString() });
        }

        // ============================================================
        //  FETCH EMPLOYEE TRANSACTIONS  (Journal Entry search)
        // ============================================================
        function fetchEmployeeTransactions(fromDate, toDate, subsidiary, employeeId, accounts) {

            var data = {
                employeeName: employeeId,
                openingBalance: {
                    debit: 0,
                    credit: 0,
                    balance: 0
                },
                totalSummary: {
                    totalDebits: 0,
                    totalCredits: 0,
                    closingBalance: 0
                },
                transactions: []
            };

            /* =========================================================
             * 1️⃣  OPENING BALANCE — journal lines BEFORE fromDate
             * ========================================================= */
            var openingSearch = search.create({
                type: "journalentry",
                settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "Journal"],
                    "AND",
                    ["account", "anyof", accounts],
                    "AND",
                    ["name", "anyof", employeeId],
                    "AND",
                    ["trandate", "before", fromDate],
                    "AND",
                    ["subsidiary", "anyof", subsidiary]
                ],
                columns: [
                    search.createColumn({ name: "debitamount", summary: "SUM" }),
                    search.createColumn({ name: "creditamount", summary: "SUM" })
                ]
            });

            var openingResult = openingSearch.run().getRange({ start: 0, end: 1 });

            log.debug('openingResult', openingResult);
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
             * 3️⃣  TRANSACTIONS WITHIN DATE RANGE
             * ========================================================= */
            var transactionSearch = search.create({
                type: "journalentry",
                settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "Journal"],
                    "AND",
                    ["account", "anyof", accounts],
                    "AND",
                    ["name", "anyof", employeeId],
                    "AND",
                    ["trandate", "within", fromDate, toDate],
                    "AND",
                    ["subsidiary", "anyof", subsidiary]
                ],
                columns: [
                    search.createColumn({ name: "trandate", sort: search.Sort.ASC, label: "Date" }),
                    search.createColumn({ name: "tranid", label: "Document Number" }),
                    search.createColumn({ name: "account", label: "Account" }),
                    search.createColumn({ name: "accounttype", label: "Account Type" }),
                    search.createColumn({ name: "entity", label: "Name" }),
                    search.createColumn({ name: "creditamount", label: "Amount (Credit)" }),
                    search.createColumn({ name: "debitamount", label: "Amount (Debit)" }),
                    search.createColumn({ name: "memo", label: "Memo" })
                ]
            });

            var runningBalance = data.openingBalance.balance;
            var totalDebit = 0;
            var totalCredit = 0;

            transactionSearch.run().each(function (result) {
                var debit = parseFloat(result.getValue("debitamount")) || 0;
                var credit = parseFloat(result.getValue("creditamount")) || 0;

                totalDebit += debit;
                totalCredit += credit;

                runningBalance += debit;
                runningBalance -= credit;

                data.totalSummary.closingBalance = runningBalance;

                data.transactions.push({
                    date: result.getValue("trandate"),
                    account: result.getText("account"),
                    accountType: result.getValue("accounttype"),
                    entity: result.getText("entity"),
                    memo: result.getValue("memo"),
                    debit: debit ? debit.toFixed(2) : "",
                    credit: credit ? credit.toFixed(2) : "",
                    documentNumber: result.getValue("tranid"),
                });

                return true;
            });

            data.totalSummary.totalDebits = totalDebit;
            data.totalSummary.totalCredits = totalCredit;

            /* =========================================================
             * 4️⃣  TOTAL ROW — removed, totals now passed via totalSummary
             * ========================================================= */
            log.debug('data', data);
            return data;
        }

        // ============================================================
        //  HELPERS
        // ============================================================
        function getFormattedDateTime() {
            var currentDate = new Date();
            currentDate.setHours(currentDate.getHours() + 3); // UTC+3
            return currentDate;
        }

        function getSubsidiaryInfo(subsidiaryId) {
            var companyId = runtime.accountId || "unknown";
            if (companyId.indexOf('_SB') !== -1) {
                companyId = companyId.replace('_SB', '-sb');
            }

            if (!subsidiaryId) {
                return { name: "Unknown Subsidiary", logoUrl: null };
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
                    logoUrl = 'https://' + companyId + '.app.netsuite.com' + logoFile.url;
                }

                return {
                    name: name || "Unknown Subsidiary",
                    vatregnumber: vatregnumber || "",
                    mainaddress_text: mainaddress_text || "",
                    logoUrl: logoUrl
                };
            } catch (e) {
                log.error("Error loading subsidiary info", e);
                return { name: "Unknown Subsidiary", logoUrl: null };
            }
        }

        function getEmployeeInfo(employeeId) {
            if (!employeeId) {
                return { entityid: "Unknown", fullname: "", email: "", department: "" };
            }

            var empSearch = search.create({
                type: 'employee',
                filters: [["internalid", "is", employeeId]],
                columns: [
                    "entityid",
                    "firstname",
                    "lastname",
                    "email",
                    "department",
                    "title"
                ]
            });

            var result = empSearch.run().getRange({ start: 0, end: 1 });

            if (result.length > 0) {
                var firstName = result[0].getValue("firstname") || "";
                var lastName = result[0].getValue("lastname") || "";
                return {
                    entityid: result[0].getValue("entityid"),
                    fullname: (firstName + " " + lastName).trim(),
                    email: result[0].getValue("email"),
                    department: result[0].getText("department"),
                    title: result[0].getValue("title")
                };
            } else {
                return { entityid: "Unknown", fullname: "", email: "", department: "", title: "" };
            }
        }

        function logUsage(context, message) {
            var remainingUsage = runtime.getCurrentScript().getRemainingUsage();
            log.audit(message, 'Remaining governance units: ' + remainingUsage);
        }

        return {
            onRequest: onRequest
        };
    });