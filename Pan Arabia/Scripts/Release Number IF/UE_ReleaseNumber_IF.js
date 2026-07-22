/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/log','N/task'], function(record, log,task) {

    function afterSubmit(context) {
        if (context.type === context.UserEventType.CREATE || context.type === context.UserEventType.EDIT) {
            try {
  
                var scriptTask = task.create({taskType: task.TaskType.SCHEDULED_SCRIPT});
                scriptTask.scriptId = 'customscript_vs_itemreleasenumberss';
                scriptTask.deploymentId = 'customdeploy1';
                scriptTask.params = {
                        'custscript_vs_transactionidif' : context.newRecord.id,
                        'custscript_vs_transactiontypeif' : 'ITEMFULFILLMENT'
                    };
                    log.debug('Script is working');
                var scriptTaskId = scriptTask.submit();
                  return true;
                  
                } catch (error) {
                  log.error({title: 'ERROR!!!!' , details: error});
                  
                }
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});
