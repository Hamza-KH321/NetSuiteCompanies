/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/log','N/task'], function(record, log,task) {

  function afterSubmit(context) {
      try {

          var scriptTask = task.create({taskType: task.TaskType.SCHEDULED_SCRIPT});
          scriptTask.scriptId = 'customscript_vs_sfdawhlockss';
          scriptTask.deploymentId = 'customdeploy1';
          scriptTask.params = {
                  'custscript_vs_recordid' : context.newRecord.id,
                  'custscript_vs_recordtype' : 'itemreceipt'
              };
          var scriptTaskId = scriptTask.submit();
            return true;
            
          } catch (error) {
            log.error({title: 'ERROR!!!!' , details: error});
            
          }
  }

  return {
      afterSubmit: afterSubmit
  };
});
