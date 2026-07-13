/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/search', 'N/record', 'N/log'], (search, record, log) => {

    function execute(context) {
        try {
            // Build the search
            const searchObj = search.create({
                type: 'customrecord_vs_giftslisttrans',
                filters: [
                    ['created', 'within', 'today'],
                    'AND',
                    ['systemnotes.context', 'anyof', 'CSV']
                ],
                columns: [
                    search.createColumn({ name: 'custrecord_vs_parent_new' }),
                    search.createColumn({ name: 'custrecord_vs_quantity_new' })
                ]
            });

            let parentTotals = {};

            searchObj.run().each(result => {
                const parentId = result.getValue('custrecord_vs_parent_new');
                const qtyStr = result.getValue('custrecord_vs_quantity_new');
                const qty = parseFloat(qtyStr) || 0;

                if (parentId) {
                    if (!parentTotals[parentId]) {
                        parentTotals[parentId] = 0;
                    }
                    parentTotals[parentId] += qty;
                }
                return true;
            });

            log.audit('Parent Totals', parentTotals);

            // Update each parent record
            Object.keys(parentTotals).forEach(parentId => {
                try {
                    const parentRec = record.load({
                        type: 'customrecord_vs_giftstrans',
                        id: parentId,
                        isDynamic: false
                    });

                    parentRec.setValue({
                        fieldId: 'custrecord_vs_total_qty',
                        value: parentTotals[parentId]
                    });

                    parentRec.save();
                    log.debug('Parent Updated',
                        `Parent ${parentId} total qty set to ${parentTotals[parentId]}`);
                } catch (err) {
                    log.error('Parent Save Error',
                        `Parent ${parentId}: ${err.message}`);
                }
            });

        } catch (e) {
            log.error('Scheduled Script Error', e);
        }
    }

    return { execute };
});
