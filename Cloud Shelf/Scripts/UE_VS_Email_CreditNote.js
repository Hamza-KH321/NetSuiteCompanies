/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function (record, log) {

    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.EDIT && context.type !== context.UserEventType.XEDIT ) return;

        try {
            const newRecord = context.newRecord;

            const clearStatusText = newRecord.getText({ fieldId: 'custbody_ksa_clear_report_status' });

            log.debug('Clear Report Status (Text)', clearStatusText);

            if (clearStatusText === 'CLEARED' || clearStatusText === 'REPORTED') {
                newRecord.setValue({ fieldId: 'tobeemailed', value: true });

                log.debug('tobeemailed checkbox set to TRUE because status is CLEARED');
            }
        } catch (error) {
            log.error('ERROR!', error);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
