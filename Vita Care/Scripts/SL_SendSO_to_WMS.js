/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/ui/serverWidget', 'N/search', 'N/workflow', 'N/record'],
  (serverWidget, search, workflow, record) => {

    const onRequest = (context) => {
      if (context.request.method === 'GET') {
        const form = serverWidget.createForm({ title: 'Sales Orders - Send to WMS' });

        const sublist = form.addSublist({ id: 'custpage_so_list', type: serverWidget.SublistType.LIST, label: 'Sales Orders' });
        sublist.addMarkAllButtons();
        sublist.addField({ id: 'custpage_select', type: serverWidget.FieldType.CHECKBOX, label: 'Select' });
        sublist.addField({ id: 'custpage_so_int_id', type: serverWidget.FieldType.TEXT, label: 'Int ID' });
        sublist.addField({ id: 'custpage_so_id', type: serverWidget.FieldType.TEXT, label: 'SO#' });
        sublist.addField({ id: 'custpage_customer', type: serverWidget.FieldType.TEXT, label: 'Customer' });
        sublist.addField({ id: 'custpage_date', type: serverWidget.FieldType.TEXT, label: 'Date' });
        sublist.addField({ id: 'custpage_salesrep', type: serverWidget.FieldType.TEXT, label: 'Sales Rep' });
        sublist.addField({ id: 'custpage_amount', type: serverWidget.FieldType.CURRENCY, label: 'Amount' });

        const salesOrderSearch = search.create({
          type: search.Type.SALES_ORDER,
          filters: [
            ['mainline', 'is', 'T'],
            'AND',
            ["workflow.currentstate", "anyof", "436"],
            'AND',
            ["status", "anyof", "SalesOrd:B"],
            //["status","noneof","SalesOrd:H"],
            "AND",
            ["mainline", "is", "T"],
            "AND",
            ["custbody_vs_so_integration_status", "doesnotcontain", "Sent"]
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
        if (results) {
          results.forEach((result, index) => {

            sublist.setSublistValue({ id: 'custpage_so_int_id', line: index, value: result.id });
            sublist.setSublistValue({ id: 'custpage_so_id', line: index, value: '<a href="https://7065838.app.netsuite.com/app/accounting/transactions/salesord.nl?id=' + result.id + '">' + result.getValue('tranid') }) + '</a>';
            sublist.setSublistValue({ id: 'custpage_customer', line: index, value: result.getText('entity') || '' });
            sublist.setSublistValue({ id: 'custpage_date', line: index, value: result.getValue('trandate') });
            sublist.setSublistValue({ id: 'custpage_salesrep', line: index, value: result.getText('salesrep') || '- None -' });
            sublist.setSublistValue({ id: 'custpage_amount', line: index, value: result.getValue('total').toString() });
            sublist.setSublistValue({ id: 'custpage_internalid_' + index, line: index, value: result.getValue('internalid') });
          });
        }

        form.addSubmitButton({ label: 'Submit to WMS' });
        context.response.writePage(form);

      } else {
        const request = context.request;
        const lineCount = request.getLineCount({ group: 'custpage_so_list' });

        for (let i = 0; i < lineCount; i++) {
          const isSelected = request.getSublistValue({ group: 'custpage_so_list', name: 'custpage_select', line: i });
          const soTranId = request.getSublistValue({ group: 'custpage_so_list', name: 'custpage_so_int_id', line: i });

          if (isSelected === 'T') {
            log.debug("Selected " + soTranId)
            /*  const soSearch = search.create({
                type: search.Type.SALES_ORDER,
                filters: [['tranid', 'is', soTranId]],
                columns: ['internalid']
              });
              const soResults = soSearch.run().getRange({ start: 0, end: 1 }); */
            // if (soResults.length) {
            const internalId = soTranId;//soResults[0].getValue('internalid');
            workflow.trigger({
              recordType: record.Type.SALES_ORDER,
              recordId: soTranId,
              workflowId: 'customworkflow_vs_so_cl_review',
              actionId: 'workflowaction_vs_so_sendt'
            });
            //  }
          }
        }

        const confirmationForm = serverWidget.createForm({ title: 'Submission Complete' });
        confirmationForm.addField({ id: 'custpage_msg', label: 'Message', type: serverWidget.FieldType.INLINEHTML })
          .defaultValue = '<p>Selected Sales Orders have been submitted to WMS.</p>';
        confirmationForm.addButton({ id: 'custpage_back', label: 'Back', functionName: "window.history.go(-1); return false;" });

        context.response.writePage(confirmationForm);
      }
    };

    return { onRequest };
  });
