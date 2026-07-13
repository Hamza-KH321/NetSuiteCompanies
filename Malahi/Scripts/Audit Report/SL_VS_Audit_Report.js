/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Audit Report
 */
define(['N/ui/serverWidget', 'N/search', 'N/log', 'N/render', 'N/file', 'N/format', 'N/url', 'N/record', 'N/runtime'],
    function (serverWidget, search, log, render, file, format, url, record, runtime) {

        function onRequest(context) {
            var form = serverWidget.createForm({ title: 'Audit Report' });

            var suiteletUrl = url.resolveScript({
                scriptId: 'customscript_vs_sl_audit_report',
                deploymentId: 'customdeploy_vs_sl_audit_report',
                returnExternalUrl: false
            });

            // Field Groups
            form.addFieldGroup({
                id: 'filters_group',
                label: 'Report Filters'
            });

            // Subsidiary
            var subsidiary = form.addField({
                id: 'custpage_subsidiary',
                type: serverWidget.FieldType.SELECT,
                source: 'subsidiary',
                label: 'Subsidiary',
                container: 'filters_group'
            });
            subsidiary.isMandatory = true;
            subsidiary.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.OUTSIDEABOVE });
            subsidiary.updateBreakType({ breakType: serverWidget.FieldBreakType.STARTCOL });

            // Account Type (multi-select)
            var accountTypeField = form.addField({
                id: 'custpage_accounttype',
                type: serverWidget.FieldType.MULTISELECT,
                label: 'Account Type',
                container: 'filters_group'
            });
            accountTypeField.isMandatory = true;
            accountTypeField.addSelectOption({ value: 'Expense',    text: 'Expense' });
            accountTypeField.addSelectOption({ value: 'OthExpense', text: 'Other Expense' });
            accountTypeField.addSelectOption({ value: 'OthIncome',  text: 'Other Income' });
            accountTypeField.addSelectOption({ value: 'Income',     text: 'Income' });
            accountTypeField.addSelectOption({ value: 'COGS',       text: 'Cost of Goods Sold' });
            accountTypeField.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.STARTROW });

            // Template (PDF / CSV)
            var templateField = form.addField({
                id: 'custpage_template',
                type: serverWidget.FieldType.SELECT,
                label: 'Template',
                container: 'filters_group'
            });
            templateField.isMandatory = true;
            templateField.addSelectOption({ value: 'PDF', text: 'PDF' });
            templateField.addSelectOption({ value: 'CSV', text: 'CSV' });
            templateField.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.MIDROW });

            // Action Button
            form.addButton({
                id: 'custpage_open_pdf',
                label: 'Open Audit Report',
                functionName: 'openAuditReport'
            });

            // Set default subsidiary
            var userSubsidiary = runtime.getCurrentUser().subsidiary;
            if (userSubsidiary) {
                subsidiary.defaultValue = userSubsidiary;
            }

            // Inline JS
            form.addField({
                id: 'custpage_script',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Script'
            }).defaultValue = `
            <script type="text/javascript">
                function openAuditReport() {
                    var subsidiary   = getFieldValue("custpage_subsidiary");
                    var accountTypes = getMultiSelectValues("custpage_accounttype");
                    var template     = getFieldValue("custpage_template");

                    var missingFields = [];
                    if (!subsidiary)          missingFields.push("Subsidiary");
                    if (!accountTypes.length) missingFields.push("Account Type");

                    if (missingFields.length > 0) {
                        alert("Please fill the following fields:\\n" + missingFields.join("\\n"));
                        return;
                    }

                    var frm = document.createElement("form");
                    frm.method = "POST";
                    frm.target = "_blank";
                    frm.action = "${suiteletUrl}";

                    appendInput(frm, "custpage_template",    template);
                    appendInput(frm, "custpage_subsidiary",  subsidiary);
                    appendInput(frm, "custpage_accounttype", accountTypes.join("|"));

                    document.body.appendChild(frm);
                    frm.submit();
                }

                function appendInput(frm, name, value) {
                    var input = document.createElement("input");
                    input.type  = "hidden";
                    input.name  = name;
                    input.value = value;
                    frm.appendChild(input);
                }

                function getFieldValue(fieldName) {
                    var elems = document.getElementsByName(fieldName);
                    return elems.length > 0 ? elems[0].value : "";
                }

                function getMultiSelectValues(fieldName) {
                    var elems = document.getElementsByName(fieldName);
                    if (!elems.length) return [];
                    var raw = elems[0].value;
                    return raw ? raw.split(String.fromCharCode(5)) : [];
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
        //  BUILD YEAR DATE RANGES  (computed at runtime)
        //  Current year : Jan 1 → today
        //  Previous year: Jan 1 → Dec 31
        //
        //  IMPORTANT: dates are formatted with format.format() so they
        //  always match the NetSuite account's date preference and are
        //  safe to pass directly into search filter "within".
        // ============================================================
        function getYearRanges() {
            var today        = new Date();
            var currentYear  = today.getFullYear();
            var previousYear = currentYear - 1;

            function nsDate(d) {
                return format.format({ value: d, type: format.Type.DATE });
            }

            return {
                currentYear:      currentYear,
                previousYear:     previousYear,
                currentYearFrom:  nsDate(new Date(currentYear,  0,  1)),
                currentYearTo:    nsDate(today),
                previousYearFrom: nsDate(new Date(previousYear, 0,  1)),
                previousYearTo:   nsDate(new Date(previousYear, 11, 31))
            };
        }

        // ============================================================
        //  CSV / XLS OUTPUT
        // ============================================================
        function renderCSV(context) {
            var request      = context.request;
            var subsidiaryId = request.parameters.custpage_subsidiary;
            var accountTypes = (request.parameters.custpage_accounttype || '').split('|').filter(Boolean);

            var subsidiaryInfo = getSubsidiaryInfo(subsidiaryId);
            var yearRanges     = getYearRanges();
            var reportData     = fetchAuditTransactions(subsidiaryId, accountTypes, yearRanges);

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

            var colCY = yearRanges.currentYear;
            var colPY = yearRanges.previousYear;

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
        <tr><td><b>Current Year (${colCY}):</b></td><td>${yearRanges.currentYearFrom} - ${yearRanges.currentYearTo}</td></tr>
        <tr><td><b>Previous Year (${colPY}):</b></td><td>${yearRanges.previousYearFrom} - ${yearRanges.previousYearTo}</td></tr>
        <tr><td><b>Account Types:</b></td><td>${escapeHtml(accountTypes.join(', '))}</td></tr>
        <tr><td><b>Generated On:</b></td><td>${new Date().toLocaleDateString()}</td></tr>
    </table>
</td>
</tr>
</table>

<h3>Transactions by Account Type</h3>
<table style="width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid black; font-size: 10pt;">
<thead>
<tr>
    <th style="padding: 6px 4px; text-align: left;  border: 1px solid black;">#</th>
    <th style="padding: 6px 4px; text-align: left;  border: 1px solid black;">Account Type</th>
    <th style="padding: 6px 4px; text-align: left;  border: 1px solid black;">Account</th>
    <th style="padding: 6px 4px; text-align: right; border: 1px solid black;">${colCY}</th>
    <th style="padding: 6px 4px; text-align: right; border: 1px solid black;">${colPY}</th>
</tr>
</thead>
<tbody>
`;

            var rowIndex = 1;
            reportData.groups.forEach(function (group) {
                html += `
<tr style="background-color: #c8d8e8;">
    <td colspan="3" style="padding: 6px 8px; text-align: left; border: 1px solid black; font-weight: bold;">${escapeHtml(group.accountTypeLabel)}</td>
    <td style="padding: 6px 4px; text-align: right; border: 1px solid black; font-weight: bold;">${formatNumber(group.subtotalCurrentYear)}</td>
    <td style="padding: 6px 4px; text-align: right; border: 1px solid black; font-weight: bold;">${formatNumber(group.subtotalPreviousYear)}</td>
</tr>`;

                group.accounts.forEach(function (acc) {
                    html += `
<tr>
    <td style="padding: 5px 4px; text-align: left;  border: 1px solid black;">${rowIndex++}</td>
    <td style="padding: 5px 4px; text-align: left;  border: 1px solid black;">${escapeHtml(acc.accountType)}</td>
    <td style="padding: 5px 4px; text-align: left;  border: 1px solid black;">${escapeHtml(acc.account)}</td>
    <td style="padding: 5px 4px; text-align: right; border: 1px solid black;">${formatNumber(acc.amountCurrentYear)}</td>
    <td style="padding: 5px 4px; text-align: right; border: 1px solid black;">${formatNumber(acc.amountPreviousYear)}</td>
</tr>`;
                });
            });

            html += `
</tbody>
<tfoot>
<tr style="background-color: #e3e3e3; font-weight: bold;">
    <td colspan="3" style="padding: 8px 4px; text-align: right; border: 1px solid black;"><b>Grand Total</b></td>
    <td style="padding: 8px 4px; text-align: right; border: 1px solid black;">${formatNumber(reportData.grandTotalCurrentYear)}</td>
    <td style="padding: 8px 4px; text-align: right; border: 1px solid black;">${formatNumber(reportData.grandTotalPreviousYear)}</td>
</tr>
</tfoot>
</table>
</body>
</html>
`;

            var excelFile = file.create({
                name: `Audit_Report_${colPY}_vs_${colCY}.xls`,
                fileType: file.Type.PLAINTEXT,
                contents: html
            });

            context.response.writeFile({ file: excelFile });
        }

        // ============================================================
        //  PDF OUTPUT
        // ============================================================
        function renderPDF(context) {
            var subsidiaryId = context.request.parameters.custpage_subsidiary;
            var accountTypes = (context.request.parameters.custpage_accounttype || '').split('|').filter(Boolean);

            var subsidiaryInfo = getSubsidiaryInfo(subsidiaryId);
            var yearRanges     = getYearRanges();
            var reportData     = fetchAuditTransactions(subsidiaryId, accountTypes, yearRanges);

            var auditReportData = {
                subsidiary:             subsidiaryInfo,
                accountTypes:           accountTypes.join(', '),
                currentYear:            yearRanges.currentYear,
                previousYear:           yearRanges.previousYear,
                currentYearFrom:        yearRanges.currentYearFrom,
                currentYearTo:          yearRanges.currentYearTo,
                previousYearFrom:       yearRanges.previousYearFrom,
                previousYearTo:         yearRanges.previousYearTo,
                groups:                 reportData.groups,
                grandTotalCurrentYear:  reportData.grandTotalCurrentYear,
                grandTotalPreviousYear: reportData.grandTotalPreviousYear,
                printDate:              getFormattedDateTime()
            };

            log.debug("auditReportData", auditReportData);

            var templateFile = file.load({ id: "AuditReportXML/AuditReport.xml" });
            var renderer = render.create();
            renderer.templateContent = templateFile.getContents();
            renderer.addCustomDataSource({
                format: render.DataSource.OBJECT,
                alias: "auditReportData",
                data: auditReportData
            });

            context.response.renderPdf({ xmlString: renderer.renderAsString() });
        }

        // ============================================================
        //  FETCH AUDIT TRANSACTIONS — two separate year searches, merged
        // ============================================================
        function fetchAuditTransactions(subsidiary, accountTypes, yearRanges) {

            var accountTypeLabels = {
                'Expense':    'Expense',
                'OthExpense': 'Other Expense',
                'OthIncome':  'Other Income',
                'Income':     'Income',
                'COGS':       'Cost of Goods Sold'
            };

            var data = {
                groups:                 [],
                grandTotalCurrentYear:  0,
                grandTotalPreviousYear: 0
            };

            // ── Helper: run one grouped search for a given date range ──────
            function runSearch(fromDate, toDate) {
                var resultMap = {}; // key: "accountType||account"

                log.debug('runSearch params', JSON.stringify({
                    fromDate:     fromDate,
                    toDate:       toDate,
                    subsidiary:   subsidiary,
                    accountTypes: accountTypes
                }));

                try {
                    search.create({
                        type: "transaction",
                        settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
                        filters: [
                            ["mainline",    "is",    "T"],
                            "AND",
                            ["shipping",    "is",    "F"],
                            "AND",
                            ["cogs",        "is",    "F"],
                            "AND",
                            ["taxline",     "is",    "F"],
                            "AND",
                            ["accounttype", "anyof", accountTypes],
                            "AND",
                            ["trandate",    "within", fromDate, toDate],
                            "AND",
                            ["subsidiary",  "anyof", [subsidiary]]
                        ],
                        columns: [
                            search.createColumn({ name: "accounttype", summary: "GROUP", label: "Account Type" }),
                            search.createColumn({ name: "account",     summary: "GROUP", label: "Account"      }),
                            search.createColumn({ name: "amount",      summary: "SUM",   label: "Amount"       })
                        ]
                    }).run().each(function (result) {
                        var accountType = result.getValue({ name: "accounttype", summary: "GROUP" });
                        var account     = result.getText({ name: "account",     summary: "GROUP" });
                        var amount      = parseFloat(result.getValue({ name: "amount", summary: "SUM" })) || 0;
                        var key         = accountType + '||' + account;

                        resultMap[key] = { accountType: accountType, account: account, amount: amount };
                        return true;
                    });
                } catch (e) {
                    log.error('runSearch FAILED', JSON.stringify({
                        fromDate:     fromDate,
                        toDate:       toDate,
                        subsidiary:   subsidiary,
                        accountTypes: accountTypes,
                        error:        e.message,
                        stack:        e.stack
                    }));
                    throw e;
                }

                return resultMap;
            }

            // ── Run both year searches ─────────────────────────────────────
            var currentYearMap  = runSearch(yearRanges.currentYearFrom,  yearRanges.currentYearTo);
            var previousYearMap = runSearch(yearRanges.previousYearFrom, yearRanges.previousYearTo);

            // ── Collect all unique account keys across both years ──────────
            var allKeys = {};
            Object.keys(currentYearMap).forEach(function (k)  { allKeys[k] = true; });
            Object.keys(previousYearMap).forEach(function (k) { allKeys[k] = true; });

            // ── Group by account type ──────────────────────────────────────
            var groupMap   = {};
            var groupOrder = [];

            Object.keys(allKeys).forEach(function (key) {
                var cy = currentYearMap[key]  || {};
                var py = previousYearMap[key] || {};

                var accountType = cy.accountType || py.accountType;
                var account     = cy.account     || py.account;
                var amtCY       = cy.amount      || 0;
                var amtPY       = py.amount      || 0;

                if (!groupMap[accountType]) {
                    groupMap[accountType] = {
                        accountType:          accountType,
                        accountTypeLabel:     accountTypeLabels[accountType] || accountType,
                        accounts:             [],
                        subtotalCurrentYear:  0,
                        subtotalPreviousYear: 0
                    };
                    groupOrder.push(accountType);
                }

                groupMap[accountType].accounts.push({
                    accountType:        accountType,
                    account:            account,
                    amountCurrentYear:  amtCY,
                    amountPreviousYear: amtPY
                });

                groupMap[accountType].subtotalCurrentYear  += amtCY;
                groupMap[accountType].subtotalPreviousYear += amtPY;
                data.grandTotalCurrentYear  += amtCY;
                data.grandTotalPreviousYear += amtPY;
            });

            groupOrder.forEach(function (key) {
                // Sort accounts alphabetically within each group
                groupMap[key].accounts.sort(function (a, b) {
                    return a.account.localeCompare(b.account);
                });
                data.groups.push(groupMap[key]);
            });

            return data;
        }

        // ============================================================
        //  HELPERS
        // ============================================================
        function getFormattedDateTime() {
            var d = new Date();
            d.setHours(d.getHours() + 3); // UTC+3
            return d;
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

                var name             = subsidiaryRec.getValue({ fieldId: 'name' });
                var vatregnumber     = subsidiaryRec.getValue({ fieldId: 'federalidnumber' });
                var mainaddress_text = subsidiaryRec.getValue({ fieldId: 'mainaddress_text' });
                var logoFileId       = subsidiaryRec.getValue({ fieldId: 'logo' });
                var logoUrl          = null;

                if (logoFileId) {
                    var logoFile = file.load({ id: logoFileId });
                    logoUrl = 'https://' + companyId + '.app.netsuite.com' + logoFile.url;
                }

                return {
                    name:             name || "Unknown Subsidiary",
                    vatregnumber:     vatregnumber || "",
                    mainaddress_text: mainaddress_text || "",
                    logoUrl:          logoUrl
                };
            } catch (e) {
                log.error("Error loading subsidiary info", e);
                return { name: "Unknown Subsidiary", logoUrl: null };
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