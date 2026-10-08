/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || PO Total Changed
 */
define(['N/log', 'N/record', 'N/runtime'],
    function (log, record, runtime) {

        function afterSubmit(context) {
            try {
                var newRec = context.newRecord;
                var oldRec = context.oldRecord;
                var type = context.type;

                log.debug("Event Type", type);

                // Only run on EDIT or XEDIT
                if (type != context.UserEventType.EDIT && type != context.UserEventType.XEDIT) {
                    log.debug("Skip", "Not an edit operation. Event Type: " + type);
                    return;
                }

                // Get totals
                var oldTotal = oldRec.getValue('total');
                var newTotal = newRec.getValue('total');

                log.debug("Totals", {
                    oldTotal: oldTotal,
                    newTotal: newTotal
                });

                // Get current user
                var userId = runtime.getCurrentUser().id;

                // Compare totals
                if (Number(oldTotal) != Number(newTotal)) {

                    log.audit(
                        "TOTAL CHANGED",
                        "PO total changed from " + oldTotal + " to " + newTotal
                    );

                    // Get existing total changes log
                    var existingLog = newRec.getValue('custbody_vs_total_changes_log');

                    if (!existingLog) {
                        existingLog = "";
                    }

                    // Get current date and time
                    var changeDateTime = new Date();

                    // Format date and time
                    var formattedDateTime =
                        (changeDateTime.getMonth() + 1) + "/" +
                        changeDateTime.getDate() + "/" +
                        changeDateTime.getFullYear() + " " +
                        changeDateTime.getHours() + ":" +
                        (changeDateTime.getMinutes() < 10 ? "0" : "") +
                        changeDateTime.getMinutes() + ":" +
                        (changeDateTime.getSeconds() < 10 ? "0" : "") +
                        changeDateTime.getSeconds();

                    // Create new log entry
                    var newLogEntry =
                        "(Old Total: " + oldTotal +
                        ", New Total: " + newTotal +
                        ", Change DateTime: " + formattedDateTime + ")";

                    // Append to existing log
                    var updatedLog = existingLog;

                    if (updatedLog) {
                        updatedLog += ", " + newLogEntry;
                    } else {
                        updatedLog = newLogEntry;
                    }

                    log.debug("Total Changes Log", {
                        existingLog: existingLog,
                        newLogEntry: newLogEntry,
                        updatedLog: updatedLog
                    });

                    // Update fields
                    record.submitFields({
                        type: record.Type.PURCHASE_ORDER,
                        id: newRec.id,
                        values: {
                            custbody_vs_total_changed: true,
                            custbody_vs_modified_by: userId,
                            custbody_vs_total_changes_log: updatedLog
                        },
                        options: {
                            ignoreMandatoryFields: true
                        }
                    });

                    log.debug("Fields Updated", {
                        custbody_vs_total_changed: true,
                        custbody_vs_modified_by: userId,
                        custbody_vs_total_changes_log: updatedLog
                    });

                } else {

                    log.debug(
                        "No Change",
                        "Total remained the same. Unchecking custbody_vs_total_changed."
                    );

                    // Uncheck the checkbox if total did not change
                    record.submitFields({
                        type: record.Type.PURCHASE_ORDER,
                        id: newRec.id,
                        values: {
                            custbody_vs_total_changed: false
                        },
                        options: {
                            ignoreMandatoryFields: true
                        }
                    });

                    log.debug(
                        "Checkbox Updated",
                        "custbody_vs_total_changed set to false"
                    );
                }

            } catch (err) {
                log.error("Error", {
                    name: err.name,
                    message: err.message,
                    stack: err.stack
                });
            }
        }

        return {
            afterSubmit: afterSubmit
        };

    });