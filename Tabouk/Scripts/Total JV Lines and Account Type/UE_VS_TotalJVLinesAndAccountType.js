/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log', 'N/task', 'N/search'], function(record,log , task, search) {

    function afterSubmit(context) {
        
        try {
            // log.debug('context' , context);
            // log.debug('Type' , context.newRecord.type);
            // log.debug('ID' , context.newRecord.id);

            var scriptTask = task.create({taskType: task.TaskType.SCHEDULED_SCRIPT});
            scriptTask.scriptId = 'customscript_vs_sstotaljvlines';
            scriptTask.deploymentId = 'customdeploy_vs_sstotaljvlines_deploy';
            scriptTask.params = {
                    'custscript_vs_recordid' : context.newRecord.id,
                    'custscript_vs_recordtype' : context.newRecord.type
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
