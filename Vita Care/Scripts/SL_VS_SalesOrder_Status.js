/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/search', 'N/log', 'N/https'], function (serverWidget, search, log, https) {

    function onRequest(context) {
        var form = serverWidget.createForm({ title: 'Sales Order Status Lookup' });

        var salesOrderField = form.addField({ id: 'custpage_sales_order', type: serverWidget.FieldType.TEXT, label: 'Enter Sales Order Internal ID' });
        salesOrderField.isMandatory = true;
        var resultsField = form.addField({ id: 'custpage_results', type: serverWidget.FieldType.INLINEHTML, label: 'Results' });

        resultsField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
        form.addSubmitButton({ label: 'Get Status' });

        if (context.request.method === 'POST') {
            var request = context.request;
            var enteredSalesOrderIdAPI = request.parameters.custpage_sales_order || '';
            var enteredSalesOrderId = request.parameters.custpage_sales_order || '';
            enteredSalesOrderId = enteredSalesOrderId.replace(/\D/g, '');
            var wmsStatus = "N/A"; // Default value

            if (enteredSalesOrderId) {
                try {
                    var apiUrl = 'https://vitacare-wms-service-prod-181839338436.us-central1.run.app/sales-order/status?orderNumber=' + enteredSalesOrderIdAPI;
                    var response = https.get({
                        url: apiUrl,
                        headers: {
                            'Accept': '*/*',
                            'Content-Type': 'application/json',
                            'Connection': 'keep-alive',
                            'Accept-Encoding': 'gzip, deflate, br',
                            "Authorization": "Basic Vml0YWNhcmVBZG1pbjoxMjM0NTY3OA=="
                        }
                    });

                    log.debug('response', response);

                    if (response.code == 200 && response.body) {
                        wmsStatus = response.body.trim();
                        log.debug('wmsStatus', wmsStatus);
                    }
                } catch (error) {
                    log.error({ title: 'API Error', details: error });
                    wmsStatus = "N/A";
                }

                var salesOrderSearch = search.create({
                    type: "salesorder",
                    settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                    filters: [
                        ["type", "anyof", "SalesOrd"],
                        "AND",
                        ["mainline", "is", "T"],
                        "AND",
                        ["trandate", "after", "01/01/2023"],
                        "AND",
                        ["number", "equalto", enteredSalesOrderId]
                    ],
                    columns: [
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

                var resultSet = salesOrderSearch.run();
                var firstResult = resultSet.getRange({ start: 0, end: 1 });

                var tableHTML = `<h2>Sales Order Details</h2><p>No matching Sales Order found.</p>`;

                if (firstResult.length > 0) {
                    var row = firstResult[0];

                    var documentNumber = row.getValue({ name: "tranid" }) || "N/A";
                    var customerName = row.getValue({ name: "altname", join: "customer" }) || "N/A";
                    var status = row.getValue({ name: "statusref" }) || "N/A";
                    var warehouse = row.getText({ name: "location" }) || "N/A";
                    var totalAmount = row.getValue({ name: "total" }) || "N/A";
                    var error3PL = row.getValue({ name: "custbody_ns_vc_trans_error_interfacing" }) || "N/A";
                    var salesrep = row.getText({ name: "salesrep" }) || "N/A";
                    var currentApproval = row.getValue({ name: "custbody_vs_so_current_status_app" }) || "N/A";

                    tableHTML = `
                    <div style="padding: 10px; margin: auto; width: 50%; margin-top: 250px; margin-left: -100px;"> <!-- Shifted left -->
                    <table style="width: 60%; margin: auto; border-collapse: collapse; font-size: 16px; text-align: center;">
                        <tr>
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
                        <tr>
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
                    </table>
                    </div>
                    `;
                }

                resultsField.defaultValue = tableHTML;
            }
        }

        context.response.writePage(form);
    }

    return { onRequest: onRequest };
});