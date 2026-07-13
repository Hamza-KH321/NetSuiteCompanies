/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/log'], (log) => {

    function beforeSubmit(context) {
        try {
            if (context.type !== context.UserEventType.CREATE) return;

            const newRecord = context.newRecord;

            newRecord.setValue({ fieldId: 'customform', value: 103 });
            newRecord.setValue({ fieldId: 'custbody_vs_demand_planning_order', value: true });

            log.debug('Before Submit', 'Form set to 103 and custbody_vs_demand_planning_order set to true');

        } catch (e) {
            log.error('Error in beforeSubmit', e);
        }
    }

    return { beforeSubmit };

});
