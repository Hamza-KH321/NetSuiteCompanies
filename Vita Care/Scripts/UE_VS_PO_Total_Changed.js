/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/log', 'N/record', 'N/runtime'], 
function (log, record, runtime) {

    function afterSubmit(context) {
        try {
            var newRec = context.newRecord;
            var oldRec = context.oldRecord;
            var type = context.type;

            // Only run on EDIT
            if (type !== context.UserEventType.EDIT || type !== context.UserEventType.XEDIT) {
                log.debug("Skip", "Not an edit operation.");
                return;
            }

            // Get totals
            var oldTotal = oldRec.getValue('total');
            var newTotal = newRec.getValue('total');

            log.debug("Totals", { oldTotal: oldTotal, newTotal: newTotal });

            // Compare totals
            if (Number(oldTotal) !== Number(newTotal)) {

                log.audit("TOTAL CHANGED", "PO total changed from " + oldTotal + " to " + newTotal);

                // Get current user
                var userId = runtime.getCurrentUser().id;

                // Update both fields
                record.submitFields({
                    type: record.Type.PURCHASE_ORDER,
                    id: newRec.id,
                    values: {
                        custbody_vs_total_changed: true,
                        custbody_vs_modified_by: userId
                    },
                    options: {
                        ignoreMandatoryFields: true
                    }
                });

                log.debug("Fields Updated", {
                    custbody_vs_total_changed: true,
                    custbody_vs_modified_by: userId
                });

            } else {
                log.debug("No Change", "Total remained the same.");
            }

        } catch (err) {
            log.error("Error", err);
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});
