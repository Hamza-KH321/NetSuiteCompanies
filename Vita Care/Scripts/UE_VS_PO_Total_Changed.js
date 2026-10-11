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

                log.debug('Event Type', type);

                // Only run on EDIT or XEDIT
                if (type != context.UserEventType.EDIT &&
                    type != context.UserEventType.XEDIT) {
                    log.debug('Skip', 'Not an edit operation. Event Type: ' + type);
                    return;
                }

                if (!oldRec) {
                    log.debug('Skip', 'Old record is not available.');
                    return;
                }

                // Get totals
                var oldTotal = Number(oldRec.getValue('total')) || 0;
                var newTotal = Number(newRec.getValue('total')) || 0;

                log.debug('Totals', {
                    oldTotal: oldTotal,
                    newTotal: newTotal
                });

                // Get current user
                var userId = runtime.getCurrentUser().id;

                // Compare totals
                if (oldTotal != newTotal) {

                    log.audit(
                        'TOTAL CHANGED',
                        'PO total changed from ' + oldTotal + ' to ' + newTotal
                    );

                    // Get existing total changes log
                    var existingLog = newRec.getValue(
                        'custbody_vs_total_changes_log'
                    ) || '';

                    // Get current date and time
                    var changeDateTime = new Date();

                    // Format date and time
                    var formattedDateTime =
                        (changeDateTime.getMonth() + 1) + '/' +
                        changeDateTime.getDate() + '/' +
                        changeDateTime.getFullYear() + ' ' +
                        changeDateTime.getHours() + ':' +
                        (changeDateTime.getMinutes() < 10 ? '0' : '') +
                        changeDateTime.getMinutes() + ':' +
                        (changeDateTime.getSeconds() < 10 ? '0' : '') +
                        changeDateTime.getSeconds();

                    // Create new log entry
                    var newLogEntry =
                        '(Old Total: ' + oldTotal +
                        ', New Total: ' + newTotal +
                        ', Change DateTime: ' + formattedDateTime + ')';

                    // Append to existing log
                    var updatedLog = existingLog;

                    if (updatedLog) {
                        updatedLog += ', ' + newLogEntry;
                    } else {
                        updatedLog = newLogEntry;
                    }

                    log.debug('Total Changes Log', {
                        existingLog: existingLog,
                        newLogEntry: newLogEntry,
                        updatedLog: updatedLog
                    });

                    // Check whether the checkbox should remain unchecked
                    var skipCheckbox = false;

                    if (
                        (oldTotal <= 50000 && newTotal <= 50000) ||
                        (oldTotal > 50000 && newTotal <= 500000) ||
                        (oldTotal > 500000 && newTotal <= 1000000) ||
                        (oldTotal > 1000000 && newTotal > 1000000)
                    ) {
                        skipCheckbox = true;
                    }

                    log.debug('Checkbox Decision', {
                        oldTotal: oldTotal,
                        newTotal: newTotal,
                        skipCheckbox: skipCheckbox
                    });

                    // Update fields
                    var fieldValues = {
                        custbody_vs_total_changes_log: updatedLog,
                        custbody_vs_modified_by: userId
                    };

                    if (skipCheckbox) {
                        fieldValues.custbody_vs_total_changed = false;

                        log.debug(
                            'Checkbox Not Checked',
                            'Total changed, but the specified conditions apply.'
                        );
                    } else {
                        fieldValues.custbody_vs_total_changed = true;

                        log.debug(
                            'Checkbox Checked',
                            'Total changed and none of the exception conditions apply.'
                        );
                    }

                    record.submitFields({
                        type: record.Type.PURCHASE_ORDER,
                        id: newRec.id,
                        values: fieldValues,
                        options: {
                            ignoreMandatoryFields: true
                        }
                    });

                    log.debug('Fields Updated', fieldValues);

                } else {

                    log.debug(
                        'No Change',
                        'Total remained the same. Unchecking custbody_vs_total_changed.'
                    );

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
                        'Checkbox Updated',
                        'custbody_vs_total_changed set to false'
                    );
                }

            } catch (err) {
                log.error('Error', {
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