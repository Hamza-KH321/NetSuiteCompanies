/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * @fileName SL || SO Status Bulk
 */
define(['N/ui/serverWidget', 'N/search', 'N/https', 'N/log'], function (serverWidget, search, https, log) {

    function onRequest(context) {
        try {
            var form = serverWidget.createForm({
                title: 'Sales Order Submitted to WMS'
            });

            var fromDateField = form.addField({ id: 'custpage_from_date', type: serverWidget.FieldType.DATE, label: 'From Date' });
            fromDateField.isMandatory = true;

            var toDateField = form.addField({ id: 'custpage_to_date', type: serverWidget.FieldType.DATE, label: 'To Date' });
            toDateField.isMandatory = true;

            var soNumberField = form.addField({ id: 'custpage_sales_order', type: serverWidget.FieldType.TEXT, label: 'Sales Order Document Number' });
            soNumberField.isMandatory = false;

            var resultsField = form.addField({ id: 'custpage_results', type: serverWidget.FieldType.INLINEHTML, label: 'Results' });
            resultsField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });

            form.addSubmitButton({ label: 'Get Data' });

            if (context.request.method === 'POST') {
                var request = context.request;
                var fromDate = request.parameters.custpage_from_date;
                var toDate = request.parameters.custpage_to_date;
                var enteredSalesOrderId = request.parameters.custpage_sales_order || '';

                var tableHTML = `
                    <div style="padding: 10px; margin: auto; width: 90%; margin-top: 50px;">
                    <h2 style="text-align:center;">Sales Orders Submitted to WMS</h2>
                    <table style="width: 100%; margin: auto; border-collapse: collapse; font-size: 14px; text-align: center;">
                        <tr>
                            <th style="padding: 10px; border: 1px solid black; background-color: #f5f5f5;">Date</th>
                            <th style="padding: 10px; border: 1px solid black; background-color: #f5f5f5;">Document Number</th>
                            <th style="padding: 10px; border: 1px solid black; background-color: #f5f5f5;">Customer Name</th>
                            <th style="padding: 10px; border: 1px solid black; background-color: #f5f5f5;">Warehouse</th>
                            <th style="padding: 10px; border: 1px solid black; background-color: #f5f5f5;">Total Amount</th>
                            <th style="padding: 10px; border: 1px solid black; background-color: #f5f5f5;">Error in 3PL</th>
                            <th style="padding: 10px; border: 1px solid black; background-color: #f5f5f5;">Sales Rep</th>
                            <th style="padding: 10px; border: 1px solid black; background-color: #f5f5f5;">Current Approval</th>
                            <th style="padding: 10px; border: 1px solid black; background-color: #f5f5f5;">NS Status</th>
                            <th style="padding: 10px; border: 1px solid black; background-color: #f5f5f5;">WMS Status</th>
                        </tr>
                `;

                var filters = [
                    ["type", "anyof", "SalesOrd"],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["custbody_vs_so_integration_status", "contains", "Sent"],
                    "AND",
                    ["custbody_vs_allocation_done", "is", "T"],
                    "AND",
                    ["status", "anyof", "SalesOrd:B"],
                    "AND",
                    ["trandate", "onorafter", fromDate],
                    "AND",
                    ["trandate", "before", toDate]
                ];

                if (enteredSalesOrderId && enteredSalesOrderId.trim() !== '') {
                    var cleanedId = enteredSalesOrderId.replace(/\D/g, '');
                    filters.push("AND", ["number", "equalto", cleanedId]);
                }

                var transactionSearchObj = search.create({
                    type: "transaction",
                    settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                    filters: filters,
                    columns: [
                        search.createColumn({ name: "trandate", label: "Date" }),
                        search.createColumn({ name: "tranid", label: "Document Number" }),
                        search.createColumn({ name: "altname", join: "customer", label: "Customer Name" }),
                        search.createColumn({ name: "statusref", label: "Status" }),
                        search.createColumn({ name: "location", label: "Warehouse" }),
                        search.createColumn({ name: "total", label: "Total Amount" }),
                        search.createColumn({ name: "custbody_ns_vc_trans_error_interfacing", label: "Error in 3PL" }),
                        search.createColumn({ name: "salesrep", label: "Sales Rep" }),
                        search.createColumn({ name: "custbody_vs_so_current_status_app", label: "SO Approval Current Status" })
                    ]
                });

                var resultSet = transactionSearchObj.run();
                var results = resultSet.getRange({ start: 0, end: 100 });
                var validCount = 0;

                if (results.length > 0) {
                    results.forEach(function (row) {
                        var tranDate = row.getValue({ name: "trandate" }) || "N/A";
                        var documentNumber = row.getValue({ name: "tranid" }) || "N/A";
                        var customerName = row.getValue({ name: "altname", join: "customer" }) || "N/A";
                        var status = row.getValue({ name: "statusref" }) || "N/A";
                        var warehouse = row.getText({ name: "location" }) || "N/A";
                        var totalAmount = row.getValue({ name: "total" }) || "N/A";
                        var error3PL = row.getValue({ name: "custbody_ns_vc_trans_error_interfacing" }) || "N/A";
                        var salesrep = row.getText({ name: "salesrep" }) || "N/A";
                        var currentApproval = row.getValue({ name: "custbody_vs_so_current_status_app" }) || "N/A";
                        var wmsStatus = "N/A";

                        try {
                            var apiUrl = 'https://vitacare-wms-service-prod-181839338436.us-central1.run.app/sales-order/status?orderNumber=' + documentNumber;
                            var response = https.get({
                                url: apiUrl,
                                headers: {
                                    'Accept': '*/*', 'Content-Type': 'application/json', "Authorization": "Basic Vml0YWNhcmVBZG1pbjoxMjM0NTY3OA=="
                                }
                            });

                            if (response.code === 200 && response.body) {
                                wmsStatus = response.body.trim();
                            }
                        } catch (apiErr) {
                            log.error('WMS API Error for SO ' + documentNumber, apiErr);
                            wmsStatus = "N/A";
                        }

                        // ✅ Skip orders where WMS status is "Created"
                        if (wmsStatus === "Created") {
                            log.debug("Skipping SO with Created status", documentNumber);
                            return; // Skip this record
                        }

                        validCount++;

                        tableHTML += `
                            <tr>
                                <td style="padding: 10px; border: 1px solid black;">${tranDate}</td>
                                <td style="padding: 10px; border: 1px solid black;">${documentNumber}</td>
                                <td style="padding: 10px; border: 1px solid black;">${customerName}</td>
                                <td style="padding: 10px; border: 1px solid black;">${warehouse}</td>
                                <td style="padding: 10px; border: 1px solid black;">${totalAmount}</td>
                                <td style="padding: 10px; border: 1px solid black;">${error3PL}</td>
                                <td style="padding: 10px; border: 1px solid black;">${salesrep}</td>
                                <td style="padding: 10px; border: 1px solid black;">${currentApproval}</td>
                                <td style="padding: 10px; border: 1px solid black;">${status}</td>
                                <td style="padding: 10px; border: 1px solid black;">${wmsStatus}</td>
                            </tr>
                        `;
                    });
                }

                // If all were filtered out or no results
                if (validCount === 0) {
                    tableHTML += `<tr><td colspan="10" style="padding:10px; border:1px solid black; text-align:center;">No matching Sales Orders found.</td></tr>`;
                }

                tableHTML += `
                        </table>
                    </div>
                `;
                resultsField.defaultValue = tableHTML;
            }

            context.response.writePage(form);

        } catch (e) {
            log.error('Suitelet Error', e);
            context.response.write('An unexpected error occurred: ' + e.message);
        }
    }

    return { onRequest: onRequest };
});
