/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function(record, log) {

    function beforeSubmit(context) {
        try {
            var creditMemoRec = context.newRecord;

            var createdFromId = creditMemoRec.getValue({ fieldId: 'createdfrom' });
            var createdFromText = creditMemoRec.getText({ fieldId: 'createdfrom' });

            log.debug('Created From Text', createdFromText);

            if (createdFromText && createdFromText.startsWith('Return Authorisation')) {

                log.debug('Valid Return Authorization', 'Proceeding to load and copy');

                var returnAuthRec = record.load({
                    type: record.Type.RETURN_AUTHORIZATION,
                    id: createdFromId,
                    isDynamic: false
                });

                var complaintValue = returnAuthRec.getValue({
                    fieldId: 'custbody_vs_customercomplaint'
                });

                log.debug('Complaint Value from Return Auth', complaintValue);

                creditMemoRec.setValue({
                    fieldId: 'custbody_vs_customercomplaint',
                    value: complaintValue
                });

                log.debug('Complaint Value Set on Credit Memo', complaintValue);
            } else {
                log.debug('Not created from Return Authorization', 'No action taken');
            }

        } catch (e) {
            log.error('Error in beforeSubmit', e.toString());
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };

});
