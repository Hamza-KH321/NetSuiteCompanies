/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/ui/serverWidget', 'N/workflow', 'N/url', 'N/runtime'],
function(record, search, ui, workflow, url, runtime) {

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
                    ['type', 'anyof', 'SalesOrd'], 'AND',
                    ['status', 'anyof', 'SalesOrd:A'], 'AND',
                    ['mainline', 'is', 'T'], 'AND',
                    ['workflow.workflow', 'anyof', '222'], 'AND',
                    ['workflow.isactive', 'is', 'T']
                ],
                columns: [
                    'amount', 'tranid', 'entity', 'trandate',
                    'custbody_vs_so_current_status_app',
                    search.createColumn({ name: 'custentity_vs_validatedbyfc', join: 'customer' }),
                    search.createColumn({ name: 'custworkflow_vs_cm_approved', join: 'workflow' }),
                    search.createColumn({ name: 'custworkflow_vs_customerreviewed_wf', join: 'workflow' }),
                    search.createColumn({ name: 'custworkflow_vs_cl_percentage', join: 'workflow' }),
                    'otherrefnum', 'salesrep', 'memo'
                ]
            });

            const results = soSearch.run().getRange({ start: 0, end: 1000 });
            const htmlRows = [];

                  var appFilter = "";
      if(approvalLevel != "" && approvalLevel != undefined)
      {
        switch(approvalLevel)
          {
            case '1': appFilter = "AR Manager - Credit Limit Exceed"; break;
            case '2': appFilter = "Commercial Manager - Credit Limit Exceed"; break;
            case '3': appFilter = "CFO - Credit Limit Exceed"; break;
            case '4': appFilter = "CEO - Credit Limit Exceed"; break;
          }
        log.debug("App filter is "+appFilter)
        //salesorders.filters.push(["custbody_vs_so_current_status_app","is",appFilter],"OR",["custbody_vs_so_current_status_app","isempty",""]);
      }
          
            for (let i = 0; i < results.length; i++) {
                const rec = results[i];
                const appState = rec.getValue('custbody_vs_so_current_status_app') || '';
              
        if(results[i].getValue({ name: "custbody_vs_so_current_status_app"})!=appFilter && results[i].getValue({ name: "custbody_vs_so_current_status_app"})!="General" && results[i].getValue({ name: "custbody_vs_so_current_status_app"})!="")
        {
         // j--;
         log.debug("Entered the continue condition "+results[i].getValue({ name: "custbody_vs_so_current_status_app"}));
          continue;
        }

        //add another condition for general
        if(results[i].getValue({ name: "custbody_vs_so_current_status_app"})!=appFilter && results[i].getValue({ name: "custbody_vs_so_current_status_app"})=="General")
        {
         if(appFilter!="")
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

                htmlRows.push(
                    '<tr>' +
                    '<td><input type="checkbox" name="approve_' + i + '" value="' + id + '"></td>' +
                    '<td><a href="' + urlLink + '" target="_blank">' + tranid + '</a></td>' +
                    '<td>' + entity + '</td>' +
                    '<td>' + date + '</td>' +
                    '<td>' + salesrep + '</td>' +
                    '<td>' + po + '</td>' +
                    '<td>' + amount + '</td>' +
                    '<td>' + memo + '</td>' +
                    '<td>' + cl + '</td>' +
                    '<td>' + clperc + '%</td>' +
                    '<td><input type="checkbox" disabled ' + custrev + '></td>' +
                    '<td>' + appState + '</td>' +
                    '<input type="hidden" name="intid_' + i + '" value="' + id + '">' +
                    '<input type="hidden" name="appstate_' + i + '" value="' + appState + '">' +
                    '</tr>'
                );
            }

            const form = ui.createForm({ title: 'Approve Sales Orders',hideNavBar: true });
            form.addField({ id: 'custpage_html', type: ui.FieldType.INLINEHTML, label: 'a' }).defaultValue =`
<html>
<head>
  <style>
    body {
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f8fb;
      color: #333;
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
      padding: 10px 20px;
      border: none;
      margin-top: 20px;
      border-radius: 5px;
      font-size: 14px;
      cursor: pointer;
      transition: background-color 0.3s ease;
    }

    button:hover {
      background-color: #0d6efd;
    }

    form {
      max-width: 100%;
      margin: 30px auto;
    }
  </style>
</head>
<body>
  <form method="POST">
    <table>
      <thead>
        <tr>
          <th>Approve</th>
          <th>Sales Order#</th>
          <th>Customer</th>
          <th>Date</th>
          <th>Sales Rep</th>
          <th>PO#</th>
          <th>Total</th>
          <th>Memo</th>
          <th>Credit</th>
          <th>Credit %</th>
          <th>Reviewed?</th>
          <th>Approval Stage</th>
        </tr>
      </thead>
      <tbody>
        ${htmlRows.join('')}
      </tbody>
    </table>
    <center>
    <div style="
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
"><button type="submit">Approve Selected</button></center></div>
  </form>
</body>
</html>
`;


            context.response.writePage(form);

        } else {
            const lineCount = 1000;
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

            const link = url.resolveScript({
                scriptId: 'customscript_vs_so_approve_hmtl',
                deploymentId: 'customdeploy1',
                returnExternalUrl: false
            });

            context.response.write('<script>window.location.href="' + link + '"</script>');
        }
    }

    return { onRequest };
});
