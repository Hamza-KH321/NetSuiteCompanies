/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/task', 'N/ui/dialog'], function (task, dialog) {

    function triggerScheduledScript() {
        try {
            // Create a task to execute the scheduled script
            var scheduledTask = task.create({
                taskType: task.TaskType.SCHEDULED_SCRIPT,
                scriptId: 'customscript_vs_ss_create_gift_transa'
            });

            var taskId = scheduledTask.submit();

            dialog.alert({
                title: 'Scheduled Script Started',
                message: 'The Create Gift process has started. Task ID: ' + taskId
            });
        } catch (e) {
            dialog.alert({
                title: 'Error',
                message: 'Failed to start scheduled script: ' + e.message
            });
        }
    }

    return {
        triggerScheduledScript: triggerScheduledScript
    };
});
