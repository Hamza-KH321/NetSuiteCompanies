/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/runtime','N/url','N/record'], function (runtime, url, record) {

  function beforeLoad(context) {
    try {
      if (context.type !== context.UserEventType.VIEW) return;

      var form = context.form;
      var rec = context.newRecord;
      var jeId = rec.id;

      // Prefer to resolve the document number (tranid) once here
      var tranId = rec.getValue('tranid') || '';

      var suiteletUrl = url.resolveScript({
        scriptId: 'customscript_sl_jv_excel_download',   // <-- set your Script ID
        deploymentId: 'customdeploy_sl_jv_excel_download', // <-- set your Deployment ID
        params: {
          jeId: jeId,
          jeNumber: tranId
        }
      });

      form.addButton({
        id: 'custpage_btn_download_excel',
        label: 'Download Excel',
        functionName: "window.open('" + suiteletUrl + "','_blank')"
      });
    } catch (e) {
      // keep UI safe—no blocking errors
      log.error('beforeLoad error', e);
    }
  }

  return { beforeLoad: beforeLoad };
});
