/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/log', 'N/runtime', 'N/ui/serverWidget', 'N/url'], function (log, runtime, serverWidget, url) {

  function beforeLoad(context) {
    try {
      if (context.type !== context.UserEventType.VIEW) return;

      var form = context.form;
      var rec = context.newRecord;
      var poId = rec.id;

      var intercoSoId = rec.getValue('intercotransaction');

      if (!intercoSoId) {
        log.debug('beforeLoad', 'intercotransaction is empty — button hidden.');
        return;
      }

      form.clientScriptModulePath = 'SuiteScripts/CS_VS_Create_IR_ICPO.js';

      form.addButton({ id: 'custpage_btn_create_ir_from_ic', label: 'Create Item Receipt (from IC SO Fulfillments)', functionName: 'createIRFromICSO' });

    } catch (e) {
      log.error('beforeLoad error', e);
    }
  }

  return { beforeLoad: beforeLoad };
});
