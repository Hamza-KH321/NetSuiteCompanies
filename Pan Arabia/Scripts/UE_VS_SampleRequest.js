/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(["N/record", "N/log", "N/search",'N/task'], function (record, log, search,task) {
  function afterSubmit(context) {
   
try {

var scriptTask = task.create({taskType: task.TaskType.SCHEDULED_SCRIPT});
scriptTask.scriptId = 'customscript_vs_ss_samplerequestcia';
scriptTask.deploymentId = 'customdeploy1';
scriptTask.params = {
        'custscript_vs_transid' : context.newRecord.id,
        'custscript_vs_transactiontype' : 'customsale_vs_samplerequest'
    };
var scriptTaskId = scriptTask.submit();
  return true;
  
} catch (error) {
  log.error({title: 'ERROR!!!!' , details: error});
  
}

  }
  return {
    afterSubmit: afterSubmit,
  };
});
