/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || RMA SO Type
 */
define(['N/record', 'N/log'], function (record, log) {

    function afterSubmit(context) {
        try {
            if (context.type === context.UserEventType.DELETE) {
                return;
            }

            var rec = context.newRecord;

            var currentValue = rec.getValue({ fieldId: 'custbody_so_type_vs' });
            if (currentValue) {
                return;
            }

            if (rec.getLineCount({ sublistId: 'item' }) < 1) {
                return;
            }

            var classText = rec.getSublistText({
                sublistId: 'item',
                fieldId: 'class',
                line: 0
            });

            if (!classText) {
                return;
            }

            var soType = String(classText).split(':')[0].replace(/^\s+|\s+$/g, '');

            if (!soType) {
                return;
            }

            record.submitFields({
                type: rec.type,
                id: rec.id,
                values: { custbody_so_type_vs: soType },
                options: { enableSourcing: false, ignoreMandatoryFields: true }
            });

        } catch (e) {
            log.error({ title: 'afterSubmit - custbody_so_type_vs', details: e });
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});