/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/log','N/task'], function(record, log,task) {

    function afterSubmit(context) {
        try {
            var newRecord = context.newRecord;
            var transferLocation = newRecord.getValue({ fieldId: 'transferlocation' });

            if (transferLocation === '1') {

            var scriptTask = task.create({taskType: task.TaskType.SCHEDULED_SCRIPT});
            scriptTask.scriptId = 'customscript_vs_ss_sfdawhunlock';
            scriptTask.deploymentId = 'customdeploy1';
            scriptTask.params = {
                    'custscript_vs_recordid2' : context.newRecord.id,
                    'custscript_vs_recordtype2' : 'itemreceipt'
                };
            var scriptTaskId = scriptTask.submit();
              return true;
            } 
            } catch (error) {
              log.error({title: 'ERROR!!!!' , details: error});
              
            }
    }

    return {
        afterSubmit: afterSubmit
    };
});
