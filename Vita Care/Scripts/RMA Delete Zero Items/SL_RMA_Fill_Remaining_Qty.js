/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * @fileName SL || RMA Fill Remaining Qty
 */
define(['N/record', 'N/search', 'N/log'],
    (record, search, log) => {

        const SUBLIST = 'item';
        const INV_DETAIL_FIELD = 'inventorydetail';
        const INV_ASSIGNMENT = 'inventoryassignment';

        /**
         * Returns { itemId: returnedQty } for all RMAs created from the same source,
         * excluding the RMA being updated.
         */
        function getReturnedQtyByItem(sourceId, currentId) {
            const result = {};
            const pagedData = search.create({
                type: 'returnauthorization',
                filters: [
                    ['createdfrom', 'anyof', sourceId],
                    'AND', ['type', 'anyof', 'RtnAuth'],
                    'AND', ['status', 'noneof', 'RtnAuth:C', 'RtnAuth:H'],
                    'AND', ['mainline', 'is', 'F'],
                    'AND', ['taxline', 'is', 'F'],
                    'AND', ['shipping', 'is', 'F'],
                    'AND', ['internalid', 'noneof', currentId]
                ],
                columns: [
                    search.createColumn({ name: 'item', summary: search.Summary.GROUP }),
                    search.createColumn({ name: 'quantityshiprecv', summary: search.Summary.SUM })
                ]
            }).runPaged({ pageSize: 1000 });

            pagedData.pageRanges.forEach((pageRange) => {
                pagedData.fetch({ index: pageRange.index }).data.forEach((r) => {
                    const itemId = r.getValue({ name: 'item', summary: search.Summary.GROUP });
                    result[itemId] = Math.abs(Number(r.getValue({ name: 'quantityshiprecv', summary: search.Summary.SUM })) || 0);
                });
            });

            return result;
        }

        function fillRemainingQuantity(rmaId) {
            const rma = record.load({ type: record.Type.RETURN_AUTHORIZATION, id: rmaId, isDynamic: false });
            const sourceId = rma.getValue({ fieldId: 'createdfrom' });

            if (!sourceId) {
                return { success: false, message: 'This RMA is not created from another transaction, so there are no returned quantities to compare.' };
            }

            const returned = getReturnedQtyByItem(sourceId, rmaId);
            const lineCount = rma.getLineCount({ sublistId: SUBLIST });

            let updated = 0;
            let skipped = 0;
            const details = [];

            for (let i = 0; i < lineCount; i++) {
                const itemId = rma.getSublistValue({ sublistId: SUBLIST, fieldId: 'item', line: i });
                const qty = Math.abs(Number(rma.getSublistValue({ sublistId: SUBLIST, fieldId: 'quantity', line: i })) || 0);
                const pool = returned[itemId] || 0;

                if (pool <= 0) {
                    continue;
                }
                if (qty <= pool) {
                    // Fully returned - handled by the "Remove Fully Returned Items" button
                    returned[itemId] = pool - qty;
                    continue;
                }
                returned[itemId] = 0;
                const newQty = qty - pool;

                // Only lines with exactly one inventory detail line are updated
                let invDetail = null;
                try {
                    invDetail = rma.getSublistSubrecord({ sublistId: SUBLIST, fieldId: INV_DETAIL_FIELD, line: i });
                } catch (e) {
                    invDetail = null;
                }
                if (!invDetail || invDetail.getLineCount({ sublistId: INV_ASSIGNMENT }) !== 1) {
                    skipped++;
                    details.push({ line: i + 1, item: itemId, action: 'skipped - not exactly one inventory detail line' });
                    continue;
                }

                // Keep the sign of the original quantity, then align the detail with the line
                rma.setSublistValue({ sublistId: SUBLIST, fieldId: 'quantity', line: i, value: newQty });
                invDetail.setSublistValue({ sublistId: INV_ASSIGNMENT, fieldId: 'quantity', line: 0, value: newQty });

                updated++;
                details.push({ line: i + 1, item: itemId, action: 'updated ' + qty + ' -> ' + newQty });
            }

            if (updated > 0) {
                rma.save({ enableSourcing: false, ignoreMandatoryFields: true });
            }

            return { success: true, updated: updated, skipped: skipped, details: details };
        }

        function onRequest(context) {
            let response;
            try {
                const rmaId = context.request.parameters.rmaid;
                if (!rmaId) {
                    response = { success: false, message: 'Missing rmaid parameter.' };
                } else {
                    response = fillRemainingQuantity(rmaId);
                }
            } catch (e) {
                log.error('SL || RMA Fill Remaining Qty', e);
                response = { success: false, message: e.message || String(e) };
            }

            log.debug('Fill Remaining Qty result', JSON.stringify(response));
            context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
            context.response.write(JSON.stringify(response));
        }

        return {
            onRequest: onRequest
        };

    });
