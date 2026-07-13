/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/ui/serverWidget', 'N/search', 'N/workflow', 'N/record', 'N/url'],
  (serverWidget, search, workflow, record, url) => {

    const onRequest = (context) => {
      if (context.request.method === 'GET') {
        const salesOrderSearch = search.create({
          type: search.Type.SALES_ORDER,
          filters: [
            ['mainline', 'is', 'T'],
            'AND',
            ['workflow.currentstate', 'anyof', '436'],
            'AND',
            ['status', 'anyof', 'SalesOrd:B'],
            'AND',
            ['custbody_vs_so_integration_status', 'doesnotcontain', 'Sent']
          ],
          columns: [
            'tranid',
            'entity',
            'trandate',
            'salesrep',
            'total',
            'internalid'
          ]
        });

        const results = salesOrderSearch.run().getRange({ start: 0, end: 1000 });

        const htmlRows = [];

        results.forEach((result, i) => {
          const id = result.id;
          const tranid = result.getValue('tranid');
          const entity = result.getText('entity') || '';
          const date = result.getValue('trandate');
          const salesrep = result.getText('salesrep') || '- None -';
          const total = result.getValue('total');

          htmlRows.push(`
            <tr>
              <td><input type="checkbox" name="approve_${i}" value="${id}"></td>
              <td><a href="https://7065838.app.netsuite.com/app/accounting/transactions/salesord.nl?id=${id}" target="_blank">${tranid}</a></td>
              <td>${entity}</td>
              <td>${date}</td>
              <td>${salesrep}</td>
              <td>${total}</td>
              <input type="hidden" name="intid_${i}" value="${id}">
            </tr>
          `);
        });

        const form = serverWidget.createForm({ title: 'Sales Orders - Send to WMS', hideNavBar: true });

        form.addField({ id: 'custpage_html', type: serverWidget.FieldType.INLINEHTML, label: 'HTML' }).defaultValue = `
<html>
<head>
  <style>
    body {
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f8fb;
      color: #333;
      margin: 0;
      padding: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      box-shadow: 0 0 10px rgba(0,0,0,0.05);
      background-color: white;
      border-radius: 8px;
      overflow: hidden;
    }

    th {
      background-color: #1e90ff;
      color: white;
      padding: 10px;
      text-align: left;
      font-weight: 600;
    }

    td {
      padding: 10px;
      border-bottom: 1px solid #e6e6e6;
    }

    tr:hover {
      background-color: #f0f8ff;
    }

    a {
      color: #1e90ff;
      text-decoration: none;
      font-weight: 500;
    }

    a:hover {
      text-decoration: underline;
    }

    button {
      background-color: #1e90ff;
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      transition: background-color 0.3s ease;
    }

    button:hover {
      background-color: #0d6efd;
    }

    .invisible-button {
      opacity: 1;
      transition: opacity 0.3s;
    }

    .invisible-button:hover {
      opacity: 1;
    }

    .footer-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      background-color: #f4f8fb;
      border-top: 1px solid #ddd;
      padding: 15px 0;
      text-align: center;
      z-index: 999;
    }

    form {
      max-width: 100%;
      margin: 30px auto;
      padding-bottom: 100px;
    }

    /* Loading Overlay */
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.8);
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 1.5em;
      font-weight: bold;
      color: #333;
      z-index: 10000;
    }
  </style>

  <script>
    function showLoader() {
      document.getElementById("loaderOverlay").style.display = "flex";
    }

    window.addEventListener("DOMContentLoaded", function () {
      const form = document.querySelector("form");
      if (form) {
        form.addEventListener("submit", function () {
          showLoader();
        });
      }
    });
  </script>
</head>
<body>
  <form method="POST">
    <table>
      <thead>
        <tr>
          <th>Select</th>
          <th>Sales Order#</th>
          <th>Customer</th>
          <th>Date</th>
          <th>Sales Rep</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${htmlRows.join('')}
      </tbody>
    </table>

    <!-- ✅ Full-width footer bar -->
    <div class="footer-bar">
      <button type="submit" class="invisible-button">Submit to WMS</button>
    </div>
  </form>

  <!-- ✅ Loading overlay -->
  <div id="loaderOverlay" class="loading-overlay">
    Loading, please wait...
  </div>
</body>
</html>
`;
        
        context.response.writePage(form);

      } else {
        const request = context.request;
        const lineCount = 1000;

let allSuccess = true;

for (let i = 0; i < lineCount; i++) {
  const isSelected = request.parameters['approve_' + i];
  const soTranId = request.parameters['intid_' + i];

  if (isSelected && soTranId) {
    try {
      workflow.trigger({
        recordType: record.Type.SALES_ORDER,
        recordId: soTranId,
        workflowId: 'customworkflow_vs_so_cl_review',
        actionId: 'workflowaction_vs_so_sendt'
      });
    } catch (e) {
      allSuccess = false;
      log.error('WMS submission error for SO ID ' + soTranId, e);
    }
  }
}


        // const confirmationForm = serverWidget.createForm({ title: 'Submission Complete' });
        // confirmationForm.addField({ id: 'custpage_msg', label: 'Message', type: serverWidget.FieldType.INLINEHTML })
        //   .defaultValue = '<p>Selected Sales Orders have been submitted to WMS.</p>';
        // confirmationForm.addButton({ id: 'custpage_back', label: 'Back', functionName: "window.history.go(-1); return false;" });

        // context.response.writePage(confirmationForm);
const suiteletUrl = url.resolveScript({
    scriptId: 'customscript_vs_sl_send_so_to_wms_html', // replace with your actual script ID
    deploymentId: 'customdeploy1', // replace with your actual deployment ID
    returnExternalUrl: false
});

context.response.write(`
  <script>
    alert("${allSuccess ? '✅ Sales Order(s) submitted to WMS successfully.' : '❌ Failed to submit one or more Sales Orders to WMS.'}");
    window.top.document.getElementById("postSOWMSFrame").src = "${suiteletUrl}";
  </script>
`);
      }
    };

    return { onRequest };
  });
