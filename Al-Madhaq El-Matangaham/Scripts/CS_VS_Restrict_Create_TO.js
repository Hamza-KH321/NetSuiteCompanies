/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Restrict Create TO
 */
define(['N/log', 'N/runtime', 'N/ui/dialog'], function (log, runtime, dialog) {

    function fieldChanged(context) {
        try {

            var currentRecord = context.currentRecord;

            // 🔹 NEW LOGIC - Sync Create PO with Create TO
            if (context.fieldId == 'custcol_vs_create_po') {

                var poValue = currentRecord.getCurrentSublistValue({
                    sublistId: context.sublistId,
                    fieldId: 'custcol_vs_create_po'
                });

                log.debug('Create PO Changed', poValue);

                if (poValue == true) {

                    currentRecord.setCurrentSublistValue({
                        sublistId: context.sublistId,
                        fieldId: 'custcol_vs_create_transfer_order',
                        value: false,
                        ignoreFieldChange: true
                    });

                    log.debug('Create TO Reset', 'Unchecked because Create PO selected');

                } else {

                    currentRecord.setCurrentSublistValue({
                        sublistId: context.sublistId,
                        fieldId: 'custcol_vs_create_transfer_order',
                        value: true,
                        ignoreFieldChange: true
                    });

                    log.debug('Create TO Reset', 'Checked because Create PO unchecked');
                }

                return;
            }

            if (context.fieldId !== 'custcol_vs_create_transfer_order') {
                return;
            }

            var fieldValue = currentRecord.getCurrentSublistValue({
                sublistId: context.sublistId,
                fieldId: 'custcol_vs_create_transfer_order'
            });

            var currentRole = runtime.getCurrentUser().role;

            log.debug('fieldChanged Role', currentRole);
            log.debug('fieldChanged Value', fieldValue);

            // Only Admin or Warehouse Manager can modify the checkbox
            if (fieldValue === true && currentRole != (19, 3)) {

                dialog.alert({
                    title: 'Permission Denied',
                    message: 'This field can be modified only by the Warehouse Manager.'
                });

                currentRecord.setCurrentSublistValue({
                    sublistId: context.sublistId,
                    fieldId: 'custcol_vs_create_transfer_order',
                    value: false,
                    ignoreFieldChange: true
                });

                log.debug('Checkbox Reset', 'Forced to false');
            }

        } catch (e) {
            log.error('fieldChanged Error', e);
        }
    }

    function validateLine(context) {
        try {
            if (context.sublistId !== 'item') {
                return true;
            }

            var currentRecord = context.currentRecord;
            var fieldValue = currentRecord.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_vs_create_transfer_order'
            });

            var currentRole = runtime.getCurrentUser().role;

            log.debug('validateLine Role', currentRole);
            log.debug('validateLine Value', fieldValue);

            // Silent enforcement, Only Admin or Warehouse Manager can modify the checkbox
            if (fieldValue === true && currentRole != (19, 3)) {
                return false;
            }

            return true;

        } catch (e) {
            log.error('validateLine Error', e);
            return true;
        }
    }

    return {
        fieldChanged: fieldChanged,
        validateLine: validateLine
    };
});