/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @filename SL_TrialBalance_Customer.js
 * @description Trial Balance Suitelet - Shows grouped debit/credit per account and customer
 */

define(['N/ui/serverWidget', 'N/search', 'N/log', 'N/render', 'N/file', 'N/format', 'N/url', 'N/record', 'N/runtime'],
    function (serverWidget, search, log, render, file, format, url, record, runtime) {

        function onRequest(context) {
            if (context.request.method === 'GET') {
                var form = serverWidget.createForm({ title: 'Trial Balance Report Customer' });

                var suiteletUrl = url.resolveScript({
                    scriptId: 'customscript_vs_sl_trial_balance_custome', // update with your script ID
                    deploymentId: 'customdeploy_vs_sl_trial_balance_custome', // update with your deployment ID
                    returnExternalUrl: false
                });

                // Add field group
                form.addFieldGroup({
                    id: 'filters_group',
                    label: 'Report Filters'
                });

                // From Date
                var fromDate = form.addField({
                    id: 'custpage_from_date',
                    type: serverWidget.FieldType.DATE,
                    label: 'From Date',
                    container: 'filters_group'
                });
                fromDate.isMandatory = true;

                // To Date
                var toDate = form.addField({
                    id: 'custpage_to_date',
                    type: serverWidget.FieldType.DATE,
                    label: 'To Date',
                    container: 'filters_group'
                });
                toDate.isMandatory = true;

                // Subsidiary (optional for OneWorld)
                var subsidiary = form.addField({
                    id: 'custpage_subsidiary',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Subsidiary',
                    source: 'subsidiary',
                    container: 'filters_group'
                });

                // Template selector
                var template = form.addField({
                    id: 'custpage_template',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Template',
                    container: 'filters_group'
                });
                template.isMandatory = true;
                template.addSelectOption({ value: 'PDF', text: 'PDF' });
                template.addSelectOption({ value: 'CSV', text: 'CSV' });

                // Open button
                form.addButton({
                    id: 'custpage_open',
                    label: 'Open Trial Balance',
                    functionName: 'openTrialBalance'
                });

                // Inline HTML script block
                form.addField({
                    id: 'custpage_inline_script',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Script'
                }).defaultValue = `
            <script>
                function openTrialBalance() {
                    var from = getFieldValue("custpage_from_date");
                    var to = getFieldValue("custpage_to_date");
                    var subsidiary = getFieldValue("custpage_subsidiary");
                    var template = getFieldValue("custpage_template");

                    var missingFields = [];
                    if (!from) missingFields.push("From Date");
                    if (!to) missingFields.push("To Date");
                    if (!template) missingFields.push("Template");

                    if (missingFields.length > 0) {
                        alert("Please fill the following fields:\\n" + missingFields.join("\\n"));
                        return;
                    }

                    var form = document.createElement("form");
                    form.method = "POST";
                    form.target = "_blank";
                    form.action = "${suiteletUrl}";

                    createHiddenField(form, "custpage_from_date", from);
                    createHiddenField(form, "custpage_to_date", to);
                    createHiddenField(form, "custpage_subsidiary", subsidiary);
                    createHiddenField(form, "custpage_template", template);

                    document.body.appendChild(form);
                    form.submit();
                }

                function getFieldValue(fieldId) {
                    var field = document.getElementsByName(fieldId);
                    return field.length > 0 ? field[0].value : "";
                }

                function createHiddenField(form, name, value) {
                    var input = document.createElement("input");
                    input.type = "hidden";
                    input.name = name;
                    input.value = value;
                    form.appendChild(input);
                }
            </script>
            `;

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


            function renderPDF(context) {
                var fromDate = context.request.parameters.custpage_from_date;
                var toDate = context.request.parameters.custpage_to_date;
                var subsidiaryId = context.request.parameters.custpage_subsidiary;

                var trialBalanceData = fetchTrialBalanceData(fromDate, toDate, subsidiaryId);

                var renderer = render.create();
                var templateFile = file.load({ id: 'TrialBalance/TrialBalanceCustomer.xml' }); // Update to your actual template file ID

                renderer.templateContent = templateFile.getContents();

                renderer.addCustomDataSource({
                    format: render.DataSource.OBJECT,
                    alias: "trialBalance",
                    data: trialBalanceData
                });

                context.response.renderPdf({ xmlString: renderer.renderAsString() });
            }
            function renderCSV(context) {
                var fromDate = context.request.parameters.custpage_from_date;
                var toDate = context.request.parameters.custpage_to_date;
                var subsidiaryId = context.request.parameters.custpage_subsidiary;

                var trialBalanceData = fetchTrialBalanceData(fromDate, toDate, subsidiaryId);

                var utf8Bom = "\uFEFF"; // for Excel compatibility
                var csv = utf8Bom + "Trial Balance Report\n";
                csv += "From Date:" + fromDate + "\n";
                csv += "To Date:" + toDate + "\n";

                trialBalanceData.rows.forEach(function (group) {
                    csv += group.account + "\n";
                    csv += "customer,Initial Balance,Debit,Credit,Period Balance,Ending Balance\n";

                    group.customers.forEach(function (v) {
                        function safe(val) {
                            return val ? `"${val.toString().replace(/"/g, '""')}"` : "";
                        }

                        csv += [
                            safe(v.customer),
                            safe(v.initialBalance),
                            safe(v.debit),
                            safe(v.credit),
                            safe(v.periodBalance),
                            safe(v.endingBalance)
                        ].join(",") + "\n";
                    });

                    csv += "\n";
                });

                context.response.addHeader({
                    name: 'Content-Type',
                    value: 'text/csv; charset=utf-8'
                });
                context.response.addHeader({
                    name: 'Content-Disposition',
                    value: 'attachment; filename="trial_balance_report.csv"'
                });

                context.response.write({ output: csv });
            }


            function fetchTrialBalanceData(fromDate, toDate, subsidiaryId) {
                var resultData = {
                    fromDate: fromDate,
                    toDate: toDate,
                    subsidiary: "",
                    printDate: getFormattedDateTime(),
                    rows: []
                };

                // 1. Get initial balances before fromDate
                var openingMap = {}; // key: account|customer, value: balance
                var openingFilters = [
                    [["accounttype", "anyof", "AcctRec"]],
                    "AND", ["posting", "is", "T"],
                    "AND", ["trandate", "before", fromDate],
                    "AND", ["formulatext: CASE WHEN {name} != 'NONE' then 1 else 0 end", "startswith", "1"]

                ];
                if (subsidiaryId) {
                    openingFilters.push("AND", ["subsidiary", "anyof", subsidiaryId]);
                }
                var openingSearch = search.create({
                    type: "transaction",
                    settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
                    filters: openingFilters,
                    columns: [
                        search.createColumn({ name: "account", summary: "GROUP" }),
                        search.createColumn({ name: "entity", summary: "GROUP" }),
                        search.createColumn({
                            name: "formulanumeric",
                            summary: "SUM",
                            formula: "NVL({debitamount}, 0) - NVL({creditamount}, 0)"
                        })
                    ]
                });

                openingSearch.run().each(function (res) {
                    var account = res.getText({ name: "account", summary: "GROUP" }) || "";
                    var customer = res.getText({ name: "entity", summary: "GROUP" }) || "";
                    var key = account + '|' + customer;
                    var opening = parseFloat(res.getValue({ name: "formulanumeric", summary: "SUM" })) || 0;
                    openingMap[key] = opening;

                    return true; // continue
                });

                log.debug('Opening Balances', JSON.stringify(openingMap));
                // 2. Main search for activity in date range
                var grouped = {};
                var mainFilters = [
                    [["accounttype", "anyof", "AcctRec"]],
                    "AND", ["posting", "is", "T"],
                    "AND", ["trandate", "within", fromDate, toDate],
                    "AND", ["formulatext: CASE WHEN {name} != 'NONE' then 1 else 0 end", "startswith", "1"]


                ];
                if (subsidiaryId) {
                    mainFilters.push("AND", ["subsidiary", "anyof", subsidiaryId]);
                }



                var mainSearch = search.create({
                    type: "transaction",
                    settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
                    filters: mainFilters,
                    columns: [
                        search.createColumn({ name: "account", summary: "GROUP" }),
                        search.createColumn({ name: "entity", summary: "GROUP" }),
                        search.createColumn({
                            name: "formulacurrency1",
                            summary: "SUM",
                            formula: "NVL({debitamount},0)"
                        }),
                        search.createColumn({
                            name: "formulacurrency2",
                            summary: "SUM",
                            formula: "NVL({creditamount},0)"
                        }),
                        search.createColumn({
                            name: "formulacurrency3",
                            summary: "SUM",
                            formula: "NVL({debitamount},0) - NVL({creditamount},0)"
                        })
                    ]
                });


                // 1. Run mainSearch to get all transaction-based entries first
                mainSearch.run().each(function (res) {
                    var account = res.getText({ name: "account", summary: "GROUP" }) || "";
                    var customer = res.getText({ name: "entity", summary: "GROUP" }) || "";
                    var key = account + '|' + customer;

                    var initialBalance = openingMap[key] || 0;
                    var debit = parseFloat(res.getValue({ name: "formulacurrency1", summary: "SUM" })) || 0;
                    var credit = parseFloat(res.getValue({ name: "formulacurrency2", summary: "SUM" })) || 0;
                    var periodBalance = debit - credit;
                    var endingBalance = initialBalance + periodBalance;

                    if (!grouped[account]) {
                        grouped[account] = [];
                    }

                    grouped[account].push({
                        customer: customer,
                        initialBalance: initialBalance.toFixed(2),
                        debit: debit.toFixed(2),
                        credit: credit.toFixed(2),
                        periodBalance: periodBalance.toFixed(2),
                        endingBalance: endingBalance.toFixed(2)
                    });

                    return true;
                });

                // 2. Now add missing customers with opening balances but no transactions
                Object.keys(openingMap).forEach(function (key) {
                    var [account, customer] = key.split('|');

                    var accountGroup = grouped[account] || [];
                    var exists = accountGroup.some(function (entry) {
                        return entry.customer === customer;
                    });

                    if (!exists) {
                        if (!grouped[account]) {
                            grouped[account] = [];
                        }

                        grouped[account].push({
                            customer: customer,
                            initialBalance: openingMap[key].toFixed(2),
                            debit: "0.00",
                            credit: "0.00",
                            periodBalance: "0.00",
                            endingBalance: openingMap[key].toFixed(2)
                        });
                    }
                });

                log.debug('Grouped Data', JSON.stringify(grouped));

                // 3. Add total rows per account group
                resultData.rows = Object.keys(grouped).map(function (account) {
                    var customers = grouped[account];

                    var totals = customers.reduce(function (acc, v) {
                        acc.initialBalance += parseFloat(v.initialBalance);
                        acc.debit += parseFloat(v.debit);
                        acc.credit += parseFloat(v.credit);
                        acc.periodBalance += parseFloat(v.periodBalance);
                        acc.endingBalance += parseFloat(v.endingBalance);
                        return acc;
                    }, {
                        initialBalance: 0,
                        debit: 0,
                        credit: 0,
                        periodBalance: 0,
                        endingBalance: 0
                    });

                    customers.push({
                        customer: "Total",
                        isTotal: true,
                        initialBalance: totals.initialBalance.toFixed(2),
                        debit: totals.debit.toFixed(2),
                        credit: totals.credit.toFixed(2),
                        periodBalance: totals.periodBalance.toFixed(2),
                        endingBalance: totals.endingBalance.toFixed(2)
                    });

                    return {
                        account: account,
                        customers: customers
                    };
                });

                return resultData;
            }

            function getFormattedDateTime() {
                var currentDate = new Date();
                currentDate.setHours(currentDate.getHours() + 11);
                return currentDate.toISOString().replace("T", " ").split(".")[0];
            }


        }

        return {
            onRequest: onRequest
        };

    });
