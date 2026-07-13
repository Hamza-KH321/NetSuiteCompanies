/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/ui/serverWidget', 'N/workflow', 'N/url', 'N/runtime', 'N/query'],
  function (record, search, ui, workflow, url, runtime, query) {

    function onRequest(context) {
      const request = context.request;
      const userId = runtime.getCurrentUser().id;
      const approvalLookup = search.lookupFields({
        type: 'employee',
        id: userId,
        columns: ['custentity_vs_so_approval_level']
      });
      const approvalLevel = (approvalLookup.custentity_vs_so_approval_level && approvalLookup.custentity_vs_so_approval_level.length > 0)
        ? approvalLookup.custentity_vs_so_approval_level[0].value
        : '';


      if (request.method === 'GET') {
        const soSearch = search.create({
          type: 'salesorder',
          filters: [
            ["type", "anyof", "SalesOrd"],
            "AND",
            ["status", "anyof", "SalesOrd:A"],
            "AND",
            ["mainline", "is", "T"],
            "AND",
            ["workflow.workflow", "anyof", "222"],
            "AND",
            ["workflow.isactive", "is", "T"],
            //       "AND",
            // [["customermain.custentity_customer_gln","isnotempty",""],"OR",["custbody_so_type_vs","isnot","Pharma"]]

          ],
          columns: [
            'amount', 'tranid', 'entity', 'trandate',
            'custbody_vs_so_current_status_app',
            search.createColumn({ name: 'custentity_vs_validatedbyfc', join: 'customer' }),
            search.createColumn({ name: 'daysoverdue', join: 'customer' }),
            search.createColumn({ name: 'overduebalance', join: 'customer' }),
            search.createColumn({ name: 'custworkflow_vs_cm_approved', join: 'workflow' }),
            search.createColumn({ name: 'custworkflow_vs_customerreviewed_wf', join: 'workflow' }),
            search.createColumn({ name: 'custworkflow_vs_cl_percentage', join: 'workflow' }),
            'otherrefnum', 'salesrep', 'memo', 'custbody_vs_html_so_status',
            search.createColumn({
              name: "formulahtml",
              formula: "(case when {workflow.custwfstate_vs_valid_ratesss} = 'F' then '<h4 style=\"color:red\">- One or more item has Base Price more than the rate</h4><br/>' else '' end) || (case when {custbody_vs_days_crossed_limit} = 'T' then '<h4 style=\"color:red\">- Credit Days exceeded</h4><br/>' else '' end) ",
              label: "Formula (HTML)"
            })
          ]
        });

        // const results = soSearch.run().getRange({ start: 0, end: 1000 });

        var results = soSearch; // keep your search object safe here

        var startt = 0;
        var endd = 1000;
        var soArray = [];
        var results;

        do {
          results = soSearch.run().getRange({ start: startt, end: endd });
          soArray = soArray.concat(results);

          startt += 1000;
          endd += 1000;

        } while (results.length === 1000);

        results = soArray;

        const htmlRows = [];

        var appFilter = "";
        if (approvalLevel != "" && approvalLevel != undefined) {
          switch (approvalLevel) {
            case '1': appFilter = "AR Manager - Credit Limit Exceed"; break;
            case '2': appFilter = "Commercial Manager - Credit Limit Exceed"; break;
            case '3': appFilter = "CFO - Credit Limit Exceed"; break;
            case '4': appFilter = "CEO - Credit Limit Exceed"; break;
          }
          log.debug("App filter is " + appFilter)
          //salesorders.filters.push(["custbody_vs_so_current_status_app","is",appFilter],"OR",["custbody_vs_so_current_status_app","isempty",""]);
        }

        const visibleCustomerIds = getVisibleCustomerIds(results, appFilter);
        const customerLastPaymentMap = getCustomerLastPaymentMap(visibleCustomerIds);

        for (let i = 0; i < results.length; i++) {
          const rec = results[i];
          const appState = rec.getValue('custbody_vs_so_current_status_app') || '';

          log.debug("App state is " + appState)
          if (results[i].getValue({ name: "custbody_vs_so_current_status_app" }) != appFilter && results[i].getValue({ name: "custbody_vs_so_current_status_app" }) != "General" && results[i].getValue({ name: "custbody_vs_so_current_status_app" }) != "") {
            // j--;
            log.debug("Entered the continue condition " + results[i].getValue({ name: "custbody_vs_so_current_status_app" }));
            continue;
          }

          //add another condition for general
          if (results[i].getValue({ name: "custbody_vs_so_current_status_app" }) != appFilter && results[i].getValue({ name: "custbody_vs_so_current_status_app" }) == "General") {
            if (appFilter != "")
              continue;

          }

          const id = rec.id;
          const tranid = rec.getValue('tranid');
          const urlLink = 'https://system.netsuite.com/app/accounting/transactions/salesord.nl?id=' + id;
          const amount = rec.getValue('amount');
          const entity = rec.getText('entity');
          const date = rec.getValue('trandate');
          const salesrep = rec.getText('salesrep');
          const po = rec.getValue('otherrefnum');
          const memo = rec.getValue('memo') || '- None -';
          const cl = Math.round(Number(rec.getValue({ name: 'custworkflow_vs_cm_approved', join: 'workflow' })) * 100) / 100;
          const clperc = Number(rec.getValue({ name: 'custworkflow_vs_cl_percentage', join: 'workflow' })) || 0;
          const custrev = rec.getValue({ name: 'custentity_vs_validatedbyfc', join: 'customer' }) === true ? 'checked' : '';
          const disableApprove = custrev === 'checked' ? '' : 'disabled';
          const customerPayment = customerLastPaymentMap[rec.getValue('entity')] || {};
          const lastPaymentDate = customerPayment.date || '';
          const lastPaymentAmount = hasValue(customerPayment.amount) ? customerPayment.amount : '';
          const daysOverdueValue = rec.getValue({ name: 'daysoverdue', join: 'customer' });
          const overdueBalanceValue = rec.getValue({ name: 'overduebalance', join: 'customer' });
          const daysOverdue = hasValue(daysOverdueValue) ? daysOverdueValue : '';
          const overdueBalance = hasValue(overdueBalanceValue) ? overdueBalanceValue : '';
          const htmlfield = rec.getValue('formulahtml');

          htmlRows.push(
            '<tr>' +
            '<td><input type="checkbox" class="row-checkbox" name="approve_' + i + '" value="' + id + '" ' + disableApprove + '></td>' +
            '<td><a href="' + urlLink + '" target="_blank">' + tranid + '</a></td>' +
            '<td>' + entity + '</td>' +
            '<td>' + date + '</td>' +
            '<td>' + salesrep + '</td>' +
            '<td>' + po + '</td>' +
            '<td>' + amount + '</td>' +
            '<td>' + lastPaymentDate + '</td>' +
            '<td>' + lastPaymentAmount + '</td>' +
            '<td>' + daysOverdue + '</td>' +
            '<td>' + overdueBalance + '</td>' +
            '<td>' + memo + '</td>' +
            '<td>' + cl + '</td>' +
            '<td>' + clperc + '%</td>' +
            '<td><input type="checkbox" disabled ' + custrev + '></td>' +
            '<td>' + appState + '</td>' +
            '<td>' + htmlfield + '</td>' +
            // Embed hidden fields inside last column (invisible)
            '<td style="display:none;">' +
            '<input type="hidden" name="intid_' + i + '" value="' + id + '">' +
            '<input type="hidden" name="appstate_' + i + '" value="' + appState + '">' +
            '</td>' +
            '</tr>'
          );


        }

        log.debug("Finished loop")
        const form = ui.createForm({ title: 'Approve Sales Orders', hideNavBar: true });
        form.addField({ id: 'custpage_html', type: ui.FieldType.INLINEHTML, label: 'a' }).defaultValue = `
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

    .scroll-container {
      background-color: white;
      border-radius: 10px;
      box-shadow: 0 0 10px rgba(0,0,0,0.05);
      padding: 20px;
      margin-bottom: 80px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background-color: white;
    }

    th {
      background-color: #1e90ff;
      color: white;
      padding: 10px;
      text-align: left;
      font-weight: 600;
      position: sticky;
      top: 0;
      z-index: 1;
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
      margin: 0 auto;
    }

    #loaderOverlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255,255,255,0.85);
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    }

    .spinner {
      border: 6px solid #f3f3f3;
      border-top: 6px solid #1e90ff;
      border-radius: 50%;
      width: 60px;
      height: 60px;
      animation: spin 1s linear infinite;
      margin-bottom: 15px;
    }

    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5em;
      font-weight: bold;
      color: #333;
      z-index: 10000;
      display: none;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading-text {
      font-size: 18px;
      color: #333;
      font-weight: 500;
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

function toggleAll(source) {
  document.querySelectorAll('.row-checkbox').forEach(cb => {
    if (!cb.disabled) cb.checked = source.checked;
  });
}
  </script>
</head>
<body>
  <form method="POST">
    <div class="scroll-container">
      <table>
        <thead>
          <tr>
    <th><input type="checkbox" id="selectAll" onclick="toggleAll(this)"></th>
    <th>Sales Order#</th>
            <th>Customer</th>
            <th>Date</th>
            <th>Sales Rep</th>
            <th>PO#</th>
            <th>Total</th>
            <th>Customer Last Payment Date</th>
            <th>Customer Last Payment Amount</th>
            <th>Days Overdue</th>
            <th>Overdue Balance</th>
            <th>Memo</th>
            <th>Credit</th>
            <th>Credit %</th>
            <th>Reviewed?</th>
            <th>Approval Stage</th>
            <th>Additional</th>
          </tr>
        </thead>
        <tbody>
          ${htmlRows.join('')}
        </tbody>
      </table>
    </div>

    <div class="footer-bar">
      <button type="submit" class="invisible-button">Approve Selected</button>
    </div>
  </form>

  <div id="loaderOverlay" class="loading-overlay">
    Loading, please wait...
  </div>
</body>
</html>
`;

        log.audit("finished loading screen")
        context.response.writePage(form);

      } else {
        log.audit("ENTERED POST");
        const lineCount = 100000;
        for (let i = 0; i < lineCount; i++) {
          const approve = request.parameters['approve_' + i];
          const intid = request.parameters['intid_' + i];
          const appState = (request.parameters['appstate_' + i] || '').trim();
          if (!approve || !intid) continue;

          try {
            const actionMap = {
              'General': { state: 'workflowstate213', action: 'workflowaction1207' },
              'AR Manager - Credit Limit Exceed': { state: 'workflowstate_so_ar_mgr', action: 'workflowaction_so_ar_mgr_appr' },
              'Commercial Manager - Credit Limit Exceed': { state: 'workflowstate_so_comm_mgr', action: 'workflowaction_so_approve_comm_mgr' },
              'CFO - Credit Limit Exceed': { state: 'workflowstate_so_cfo_app', action: 'workflowaction_so_cfo_app' },
              'CEO - Credit Limit Exceed': { state: 'workflowstate_so_ceo_app', action: 'workflowaction_so_ceo_app' }
            };

            if (actionMap[appState]) {
              workflow.trigger({
                recordType: 'salesorder',
                recordId: intid,
                workflowId: 'customworkflow_vs_so_cl_review',
                stateId: actionMap[appState].state,
                actionId: actionMap[appState].action
              });
            }

            workflow.trigger({
              recordType: 'salesorder',
              recordId: intid,
              workflowId: 'customworkflow_vs_so_cl_review',
              stateId: 'workflowstate_vs_submittedso',
              actionId: 'workflowaction_vs_appbutton'
            });
          } catch (e) {
            log.error('Workflow error', e);
          }
        }

        let approvalSuccess = true;

        for (let i = 0; i < lineCount; i++) {
          const approve = request.parameters['approve_' + i];
          const intid = request.parameters['intid_' + i];
          const appState = (request.parameters['appstate_' + i] || '').trim();
          if (!approve || !intid) continue;

          try {
            const actionMap = {
              'General': { state: 'workflowstate213', action: 'workflowaction1207' },
              'AR Manager - Credit Limit Exceed': { state: 'workflowstate_so_ar_mgr', action: 'workflowaction_so_ar_mgr_appr' },
              'Commercial Manager - Credit Limit Exceed': { state: 'workflowstate_so_comm_mgr', action: 'workflowaction_so_approve_comm_mgr' },
              'CFO - Credit Limit Exceed': { state: 'workflowstate_so_cfo_app', action: 'workflowaction_so_cfo_app' },
              'CEO - Credit Limit Exceed': { state: 'workflowstate_so_ceo_app', action: 'workflowaction_so_ceo_app' }
            };

            log.debug("state + action", JSON.stringify(actionMap[appState]))
            if (actionMap[appState]) {
              workflow.trigger({
                recordType: 'salesorder',
                recordId: intid,
                workflowId: 'customworkflow_vs_so_cl_review',
                stateId: actionMap[appState].state,
                actionId: actionMap[appState].action
              });
            }

            workflow.trigger({
              recordType: 'salesorder',
              recordId: intid,
              workflowId: 'customworkflow_vs_so_cl_review',
              stateId: 'workflowstate_vs_submittedso',
              actionId: 'workflowaction_vs_appbutton'
            });
          } catch (e) {
            approvalSuccess = false;
            log.error('Workflow error', e);
          }
        }

        const link = url.resolveScript({
          scriptId: 'customscript_vs_so_approve_hmtl',
          deploymentId: 'customdeploy_vs_so_approve_hmtl',
          returnExternalUrl: false
        });

        context.response.write(`
    <script>
        alert("${approvalSuccess ? '✅ Sales Order approved successfully.' : '❌ Approval failed for one or more Sales Orders.'}");
        window.location.href = "${link}";
    </script>
`);


        context.response.write('<script>window.location.href="' + link + '"</script>');
      }
    }

    function getVisibleCustomerIds(results, appFilter) {
      const customerMap = {};
      const customerIds = [];

      for (let i = 0; i < results.length; i++) {
        const approvalState = results[i].getValue({ name: 'custbody_vs_so_current_status_app' });

        if (approvalState != appFilter && approvalState != 'General' && approvalState != '') {
          continue;
        }

        if (approvalState != appFilter && approvalState == 'General' && appFilter != '') {
          continue;
        }

        const customerId = results[i].getValue('entity');
        if (customerId && !customerMap[customerId]) {
          customerMap[customerId] = true;
          customerIds.push(customerId);
        }
      }

      return customerIds;
    }

    function getCustomerLastPaymentMap(customerIds) {
      const paymentMap = {};
      if (!customerIds || !customerIds.length) {
        return paymentMap;
      }

      const numericCustomerIds = [];
      for (let i = 0; i < customerIds.length; i++) {
        const customerId = parseInt(customerIds[i], 10);
        if (!isNaN(customerId)) {
          numericCustomerIds.push(customerId);
        }
      }

      if (!numericCustomerIds.length) {
        return paymentMap;
      }

      const sql = ''
        + 'SELECT '
        + '    c.id AS customer_id, '
        + '    p.trandate AS payment_date, '
        + '    p.foreigntotal AS payment_amount '
        + 'FROM customer c '
        + 'LEFT JOIN ( '
        + '    SELECT entity, trandate, foreigntotal '
        + '    FROM ( '
        + '        SELECT '
        + '            t.entity, '
        + '            t.trandate, '
        + '            t.foreigntotal, '
        + '            ROW_NUMBER() OVER (PARTITION BY t.entity ORDER BY t.id DESC) AS rn '
        + '        FROM transaction t '
        + "        WHERE t.type = 'CustPymt' "
        + '          AND t.entity IN (' + numericCustomerIds.join(',') + ') '
        + '    ) '
        + '    WHERE rn = 1 '
        + ') p ON p.entity = c.id '
        + 'WHERE c.id IN (' + numericCustomerIds.join(',') + ')';

      const rows = query.runSuiteQL({ query: sql }).asMappedResults();
      rows.forEach(function (row) {
        const customerId = getMappedValue(row, 'customer_id');
        if (customerId) {
          paymentMap[String(customerId)] = {
            date: getMappedValue(row, 'payment_date'),
            amount: getMappedValue(row, 'payment_amount')
          };
        }
      });

      return paymentMap;
    }

    function hasValue(value) {
      return value !== null && value !== undefined && value !== '';
    }

    function getMappedValue(result, key) {
      const upperKey = key.toUpperCase();
      return hasValue(result[key]) ? result[key] : result[upperKey];
    }

    return { onRequest };
  });
