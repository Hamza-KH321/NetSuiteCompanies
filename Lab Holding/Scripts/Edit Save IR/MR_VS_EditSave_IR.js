/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Edit Save IR
 */
define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {
        try {
            log.audit('getInputData', 'Creating Item Receipt search');

            return search.create({
                type: 'itemreceipt',
                settings: [
                    { name: 'consolidationtype', value: 'ACCTTYPE' }
                ],
                filters: [
                    ['type', 'anyof', 'ItemRcpt'],
                    'AND',
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['custbody_vs_ir_total_amount', 'isempty', ''],
                    // "AND",
                    // ["internalid", "anyof", "2662"]
                ],
                columns: [
                    search.createColumn({ name: 'internalid' })
                ]
            });

        } catch (e) {
            log.error('getInputData Error', e);
        }
    }

    function map(context) {
        try {
            var searchResult = JSON.parse(context.value);
            var itemReceiptId = searchResult.id;

            log.debug('map', 'Processing Item Receipt ID: ' + itemReceiptId);

            context.write({
                key: itemReceiptId,
                value: itemReceiptId
            });

        } catch (e) {
            log.error('map Error', e);
        }
    }

    function reduce(context) {
        try {
            var itemReceiptId = context.key;

            log.audit('reduce', 'Loading Item Receipt ID: ' + itemReceiptId);

            var itemReceiptRec = record.load({
                type: record.Type.ITEM_RECEIPT,
                id: itemReceiptId,
                isDynamic: false
            });

            var savedId = itemReceiptRec.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            log.audit('reduce', 'Successfully saved Item Receipt ID: ' + savedId);

        } catch (e) {
            log.error('reduce Error for ID ' + context.key, e);
        }
    }

    function summarize(summary) {
        try {
            log.audit('summarize', 'Map/Reduce completed');

            if (summary.inputSummary.error) {
                log.error('Input Error', summary.inputSummary.error);
            }

            summary.mapSummary.errors.iterator().each(function (key, error) {
                log.error('Map Error for key ' + key, error);
                return true;
            });

            summary.reduceSummary.errors.iterator().each(function (key, error) {
                log.error('Reduce Error for key ' + key, error);
                return true;
            });

        } catch (e) {
            log.error('summarize Error', e);
        }
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});
