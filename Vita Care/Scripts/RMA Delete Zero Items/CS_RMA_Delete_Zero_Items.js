/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 * @fileName CS || RMA Delete Zero Items
 */
define(['N/currentRecord', 'N/search', 'N/ui/dialog', 'N/log'],
    (currentRecord, search, dialog, log) => {

        const SUBLIST = 'item';
        const INV_DETAIL_FIELD = 'inventorydetail';
        const INV_ASSIGNMENT = 'inventoryassignment';

        // Checkbox body field read by the User Event on save
        const FLAG_FIELD = 'custbody_vs_fill_remaining_qty';

        function pageInit(context) {
            // Required entry point - nothing to do on page init
        }

        /**
         * Returns { itemId: returnedQty } for all RMAs created from the same source,
         * excluding the RMA currently being edited.
         */
        function getReturnedQtyByItem(sourceId, currentId) {
            const filters = [
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

            const result = {};
            const pagedData = search.create({
                type: 'returnauthorization',
                filters: filters,
                columns: [
                    search.createColumn({ name: 'item', summary: search.Summary.GROUP }),
                    search.createColumn({ name: 'quantityshiprecv', summary: search.Summary.SUM })
                ]
            }).runPaged({ pageSize: 1000 });

            pagedData.pageRanges.forEach((pageRange) => {
                pagedData.fetch({ index: pageRange.index }).data.forEach((r) => {
                    const itemId = r.getValue({ name: 'item', summary: search.Summary.GROUP });
                    const received = Math.abs(Number(r.getValue({ name: 'quantityshiprecv', summary: search.Summary.SUM })) || 0);
                    result[itemId] = received;
                });
            });

            return result;
        }

        function deleteZeroItems() {
            try {
                const rec = currentRecord.get();
                const sourceId = rec.getValue({ fieldId: 'createdfrom' });

                if (!sourceId) {
                    dialog.alert({
                        title: 'Delete Zero Items',
                        message: 'This RMA is not created from another transaction, so there are no returned quantities to compare.'
                    });
                    return;
                }

                const lineCount = rec.getLineCount({ sublistId: SUBLIST });
                if (lineCount === 0) {
                    return;
                }

                const returned = getReturnedQtyByItem(sourceId, rec.id);

                // Walk top-to-bottom so the returned pool is consumed in line order
                const linesToRemove = [];
                for (let i = 0; i < lineCount; i++) {
                    const itemId = rec.getSublistValue({ sublistId: SUBLIST, fieldId: 'item', line: i });
                    const qty = Math.abs(Number(rec.getSublistValue({ sublistId: SUBLIST, fieldId: 'quantity', line: i })) || 0);
                    const pool = returned[itemId] || 0;

                    if (pool > 0 && qty <= pool) {
                        returned[itemId] = pool - qty;
                        linesToRemove.push(i);
                    }
                }

                // Remove bottom-to-top so line indexes stay valid
                for (let d = linesToRemove.length - 1; d >= 0; d--) {
                    rec.removeLine({ sublistId: SUBLIST, line: linesToRemove[d], ignoreRecalc: true });
                }

                dialog.alert({
                    title: 'Delete Zero Items',
                    message: 'Lines removed: ' + linesToRemove.length
                });
            } catch (e) {
                console.log(e);
                dialog.alert({
                    title: 'Delete Zero Items',
                    message: 'Error: ' + (e.message || e)
                });
            }
        }

        /**
         * Returns true if the item line has exactly one inventory detail line.
         * Only reads - the line selection is cancelled afterwards.
         */
        function hasSingleInventoryDetailLine(rec, line) {
            try {
                rec.selectLine({ sublistId: SUBLIST, line: line });
                const detail = rec.getCurrentSublistSubrecord({ sublistId: SUBLIST, fieldId: INV_DETAIL_FIELD });
                return !!detail && detail.getLineCount({ sublistId: INV_ASSIGNMENT }) === 1;
            } catch (e) {
                return false;
            } finally {
                try { rec.cancelLine({ sublistId: SUBLIST }); } catch (ignore) { }
            }
        }

        /**
         * Marks the RMA so that the line quantity and inventory detail are updated on save.
         * The browser cannot edit inventory detail lines on this form, so the update itself
         * is done by the User Event (beforeSubmit) in the same save.
         */
        function fillRemainingQuantity() {
            try {
                const rec = currentRecord.get();
                const sourceId = rec.getValue({ fieldId: 'createdfrom' });

                if (!sourceId) {
                    dialog.alert({
                        title: 'Fill Remaining Quantity',
                        message: 'This RMA is not created from another transaction, so there are no returned quantities to compare.'
                    });
                    return;
                }

                const lineCount = rec.getLineCount({ sublistId: SUBLIST });
                if (lineCount === 0) {
                    return;
                }

                const returned = getReturnedQtyByItem(sourceId, rec.id);

                // Same rule as the server: returned < quantity -> quantity - returned
                const preview = [];
                const skipped = [];
                for (let i = 0; i < lineCount; i++) {
                    const itemId = rec.getSublistValue({ sublistId: SUBLIST, fieldId: 'item', line: i });
                    const qty = Math.abs(Number(rec.getSublistValue({ sublistId: SUBLIST, fieldId: 'quantity', line: i })) || 0);
                    const pool = returned[itemId] || 0;

                    if (pool <= 0) {
                        continue;
                    }
                    if (qty <= pool) {
                        returned[itemId] = pool - qty;
                        continue;
                    }
                    returned[itemId] = 0;

                    if (hasSingleInventoryDetailLine(rec, i)) {
                        preview.push('Line ' + (i + 1) + ': ' + qty + ' &rarr; ' + (qty - pool));
                    } else {
                        skipped.push('Line ' + (i + 1));
                    }
                }

                if (preview.length === 0) {
                    dialog.alert({
                        title: 'Fill Remaining Quantity',
                        message: 'No lines to update.' + (skipped.length ? '<br/>Skipped (not exactly one inventory detail line): ' + skipped.join(', ') : '')
                    });
                    return;
                }

                rec.setValue({ fieldId: FLAG_FIELD, value: true });

                dialog.alert({
                    title: 'Fill Remaining Quantity',
                    message: 'These lines will be updated (line quantity and inventory detail) when you click Save:<br/><br/>' +
                        preview.join('<br/>') +
                        (skipped.length ? '<br/><br/>Skipped (not exactly one inventory detail line): ' + skipped.join(', ') : '')
                });
            } catch (e) {
                console.log(e);
                log.debug('fillRemainingQuantity - error', e.message || String(e));
                dialog.alert({
                    title: 'Fill Remaining Quantity',
                    message: 'Error: ' + (e.message || e) +
                        '<br/><br/>Make sure the checkbox field ' + FLAG_FIELD + ' exists on the Return Authorization form.'
                });
            }
        }

        return {
            pageInit: pageInit,
            deleteZeroItems: deleteZeroItems,
            fillRemainingQuantity: fillRemainingQuantity
        };

    });