/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(["N/record", "N/log", "N/search",'N/task'], function (record, log, search,task) {
    function afterSubmit(context) {
     
  try {
  
  var scriptTask = task.create({taskType: task.TaskType.SCHEDULED_SCRIPT});
  scriptTask.scriptId = 'customscript_vs_ss_createiafocnew';
  scriptTask.deploymentId = 'customdeploy1';
  scriptTask.params = {
          'custscript_vs_id_foc' : context.newRecord.id,
          'custscript_vs_type_foc' : 'customrecord_vs_foctrans_new'
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
  