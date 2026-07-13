/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log'], (search, record, log) => {

    function getInputData() {
        try {
            const purchaseorderSearchObj = search.create({
                type: 'purchaseorder',
                settings: [{ name: 'consolidationtype', value: 'ACCTTYPE' }],
                filters: [
                    ['type', 'anyof', 'PurchOrd'],
                    'AND',
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['trandate', 'onorafter', '05/10/2025']
                ],
                columns: [
                    search.createColumn({ name: 'internalid', label: 'Internal ID' })
                ]
            });

            return purchaseorderSearchObj;
        } catch (e) {
            log.error('Error in getInputData', e);
        }
    }

    function map(context) {
        try {
            const searchResult = JSON.parse(context.value);
            const poId = searchResult.id;

            if (poId) {
                const poRecord = record.load({ type: record.Type.PURCHASE_ORDER, id: poId, isDynamic: true });

                poRecord.save({ enableSourcing: true, ignoreMandatoryFields: true });

                log.audit('Re-saved Purchase Order', `ID: ${poId}`);
            }
        } catch (e) {
            log.error('Error in map', e);
        }
    }

    return {
        getInputData, map
    };
});
