/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Vendor Reject Reason
 */
define(['N/currentRecord', 'N/ui/dialog', 'N/log'], function (currentRecord, dialog, log) {

    function saveRecord(context) {

        try {

            log.debug('saveRecord', 'Validation started');

            var rec = currentRecord.get();

            var isRejected = rec.getValue({fieldId: 'custentity_vs_vendor_rejected'});
            var rejectReason = rec.getValue({fieldId: 'custentity_vs_reject_reason'});

            log.debug('Field Values', {
                isRejected: isRejected,
                rejectReason: rejectReason
            });

            if (isRejected) {

                if (!rejectReason) {

                    log.debug('Validation Failed', 'Reject reason is missing');

                    dialog.alert({
                        title: 'Vendor Rejected',
                        message: 'This Vendor is rejected. You have to add reject reason to complete.'
                    });

                    return false;
                }
            }

            log.debug('Validation Passed', 'Record can be saved');
            return true;

        } catch (e) {

            log.error('Error in saveRecord', e);
            return false;
        }
    }

    return {
        saveRecord: saveRecord
    };

});
