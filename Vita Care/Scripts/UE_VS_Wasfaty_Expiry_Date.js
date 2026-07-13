/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Wasfaty Expiry Date
 */
define(['N/log'], function (log) {

    function beforeSubmit(context) {
        try {

            if (context.type != context.UserEventType.CREATE) {
                return;
            }

            var rec = context.newRecord;

            var parentPO = rec.getValue({ fieldId: 'custbody_vs_pobo_parentpo' });

            log.debug('Parent PO', parentPO);

            if (!parentPO) {
                log.debug('Skipped', 'Parent PO is empty');
                return;
            }

            var classTypeValue = rec.getText({ fieldId: 'custbody_vs_po_class_type' });

            log.debug('Class Type Value', classTypeValue);

            var today = new Date();
            var expiryDate = null;

            // Private Label
            if (classTypeValue == 'Private Label') {

                log.debug('Logic', 'Private Label selected → Adding 180 days');

                expiryDate = new Date(today);
                expiryDate.setDate(expiryDate.getDate() + 180);

            } else {

                var poTypeValue = rec.getValue({ fieldId: 'custbody_vs_potype' });

                log.debug('PO Type Value', poTypeValue);

                // PO Type = 3 (Wasfaty)
                if (poTypeValue == 3) {

                    log.debug('Logic', 'Wasfaty selected → Setting expiry to last day of month');

                    var year = today.getFullYear();
                    var month = today.getMonth() + 1;

                    var lastDay = new Date(year, month, 0).getDate();
                    expiryDate = new Date(year, month - 1, lastDay);
                }
            }

            if (expiryDate) {

                log.debug('Setting Expiry Date', expiryDate);

                rec.setValue({ fieldId: 'custbody_vs_poexpirydate', value: expiryDate });
            }

        } catch (e) {

            log.error({ title: 'Error in beforeSubmit', details: e });
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };

});