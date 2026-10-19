/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @fileName UE || RMA Delete Zero Lines
 */
define(['N/runtime', 'N/search', 'N/ui/serverWidget', 'N/log'],
    function (runtime, search, serverWidget, log) {

        var ALLOWED_USER_IDS = [434250, 392873, 453643];
        var ALLOWED_ROLE_ID = 3; // Administrator

        // Set to true to show the "Fill Remaining Quantity" button again (for the allowed users)
        var SHOW_FILL_REMAINING_BUTTON = false;

        // Checkbox body field on the RMA, set by the "Fill Remaining Quantity" button
        var FLAG_FIELD = 'custbody_vs_fill_remaining_qty';

        var SUBLIST = 'item';
        var INV_DETAIL_FIELD = 'inventorydetail';
        var INV_ASSIGNMENT = 'inventoryassignment';

        function isAllowedUser() {
            var user = runtime.getCurrentUser();
            return ALLOWED_USER_IDS.indexOf(Number(user.id)) !== -1 || Number(user.role) === ALLOWED_ROLE_ID;
        }

        function beforeLoad(scriptContext) {
            try {
                var type = scriptContext.type;

                // Keep the flag field out of sight - it is only a switch for the button
                var flagField = scriptContext.form.getField({ id: FLAG_FIELD });
                if (flagField) {
                    flagField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                }

                var isEditable = type === scriptContext.UserEventType.CREATE ||
                    type === scriptContext.UserEventType.EDIT ||
                    type === scriptContext.UserEventType.COPY;

                if (!isEditable) {
                    return;
                }

                var user = runtime.getCurrentUser();
                if (!isAllowedUser()) {
                    log.debug('Permission check', 'Not Allowed - user id: ' + user.id + ' (' + typeof user.id + '), role: ' + user.role + ' (' + typeof user.role + ')');
                    return;
                }

                // Path is relative to this script file - keep both files in the same folder
                scriptContext.form.clientScriptModulePath = './CS_RMA_Delete_Zero_Items.js';

                scriptContext.form.addButton({
                    id: 'custpage_btn_delete_zero_items',
                    label: 'Remove Fully Returned Items',
                    functionName: 'deleteZeroItems'
                });

                if (SHOW_FILL_REMAINING_BUTTON) {
                    scriptContext.form.addButton({
                        id: 'custpage_btn_fill_remaining_qty',
                        label: 'Fill Remaining Quantity',
                        functionName: 'fillRemainingQuantity'
                    });
                }
            } catch (e) {
                log.error('beforeLoad - Delete Zero Items button', e);
            }
        }

        /**
         * Returns { itemId: returnedQty } for all RMAs created from the same source,
         * excluding the RMA being saved (when it already exists).
         */
        function getReturnedQtyByItem(sourceId, currentId) {
            var filters = [
                ['createdfrom', 'anyof', sourceId],
                'AND', ['type', 'anyof', 'RtnAuth'],
                'AND', ['status', 'noneof', 'RtnAuth:C', 'RtnAuth:H'],
                'AND', ['mainline', 'is', 'F'],
                'AND', ['taxline', 'is', 'F'],
                'AND', ['shipping', 'is', 'F']
            ];
            if (currentId) {
                filters.push('AND', ['internalid', 'noneof', currentId]);
            }

            var result = {};
            var pagedData = search.create({
                type: 'returnauthorization',
                filters: filters,
                columns: [
                    search.createColumn({ name: 'item', summary: search.Summary.GROUP }),
                    search.createColumn({ name: 'quantityshiprecv', summary: search.Summary.SUM })
                ]
            }).runPaged({ pageSize: 1000 });

            pagedData.pageRanges.forEach(function (pageRange) {
                pagedData.fetch({ index: pageRange.index }).data.forEach(function (r) {
                    var itemId = r.getValue({ name: 'item', summary: search.Summary.GROUP });
                    result[itemId] = Math.abs(Number(r.getValue({ name: 'quantityshiprecv', summary: search.Summary.SUM })) || 0);
                });
            });

            return result;
        }

        /**
         * When the "Fill Remaining Quantity" button was used, update the line quantity and the
         * inventory detail quantity in the same save (server side, before the record is written).
         */
        function beforeSubmit(scriptContext) {
            try {
                var type = scriptContext.type;
                if (type !== scriptContext.UserEventType.CREATE && type !== scriptContext.UserEventType.EDIT) {
                    return;
                }

                var rec = scriptContext.newRecord;
                if (!rec.getValue({ fieldId: FLAG_FIELD })) {
                    return;
                }

                // The flag is a one-time switch - clear it so it is not saved as checked
                rec.setValue({ fieldId: FLAG_FIELD, value: false });

                if (!isAllowedUser()) {
                    log.audit('Fill Remaining Quantity', 'Flag ignored - user not allowed');
                    return;
                }

                var sourceId = rec.getValue({ fieldId: 'createdfrom' });
                if (!sourceId) {
                    log.audit('Fill Remaining Quantity', 'No createdfrom - nothing to compare');
                    return;
                }

                var returned = getReturnedQtyByItem(sourceId, rec.id);
                var lineCount = rec.getLineCount({ sublistId: SUBLIST });
                var summary = [];

                for (var i = 0; i < lineCount; i++) {
                    var itemId = rec.getSublistValue({ sublistId: SUBLIST, fieldId: 'item', line: i });
                    var qty = Math.abs(Number(rec.getSublistValue({ sublistId: SUBLIST, fieldId: 'quantity', line: i })) || 0);
                    var pool = returned[itemId] || 0;

                    if (pool <= 0) {
                        continue;
                    }
                    if (qty <= pool) {
                        // Fully returned - handled by the "Remove Fully Returned Items" button
                        returned[itemId] = pool - qty;
                        continue;
                    }
                    returned[itemId] = 0;
                    var newQty = qty - pool;

                    // Only lines with exactly one inventory detail line are updated
                    var detail = null;
                    try {
                        detail = rec.getSublistSubrecord({ sublistId: SUBLIST, fieldId: INV_DETAIL_FIELD, line: i });
                    } catch (e) {
                        detail = null;
                    }
                    if (!detail || detail.getLineCount({ sublistId: INV_ASSIGNMENT }) !== 1) {
                        summary.push('line ' + (i + 1) + ': skipped (not exactly one inventory detail line)');
                        continue;
                    }

                    rec.setSublistValue({ sublistId: SUBLIST, fieldId: 'quantity', line: i, value: newQty });
                    detail.setSublistValue({ sublistId: INV_ASSIGNMENT, fieldId: 'quantity', line: 0, value: newQty });
                    summary.push('line ' + (i + 1) + ': ' + qty + ' -> ' + newQty);
                }

                log.audit('Fill Remaining Quantity', summary.length ? summary.join(' | ') : 'No lines to update');
            } catch (e) {
                log.error('beforeSubmit - Fill Remaining Quantity', e);
            }
        }

        return {
            beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit
        };

    });