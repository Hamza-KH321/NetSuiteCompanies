/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Set UPC Code
 */
define(['N/record', 'N/log'], function (record, log) {

    function afterSubmit(context) {
        try {

            log.debug('afterSubmit', 'Script started');

            var rec = context.newRecord;
            var recId = rec.id;
            var recType = rec.type;

            var upcCode = rec.getValue({ fieldId: 'upccode' });
            var classId = rec.getValue({ fieldId: 'class' });

            log.debug('Values', {
                upcCode: upcCode,
                classId: classId,
                recId: recId
            });

            if ((!upcCode || upcCode == '') && classId) {

                var newValue = '';

                if (classId == 3) {
                    newValue = 'SO-' + recId;
                } else if (classId == 4) {
                    newValue = 'ZB-' + recId;
                } else if (classId == 5) {
                    newValue = 'TK-' + recId;
                }

                log.debug('Generated Value', newValue);

                if (newValue != '') {

                    record.submitFields({
                        type: recType,
                        id: recId,
                        values: {
                            upccode: newValue
                        }
                    });

                    log.debug('Success', 'UPC Code updated successfully');
                }

            } else {
                log.debug('Skipped', 'Conditions not met');
            }

        } catch (e) {
            log.error('Error in afterSubmit', e);
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});