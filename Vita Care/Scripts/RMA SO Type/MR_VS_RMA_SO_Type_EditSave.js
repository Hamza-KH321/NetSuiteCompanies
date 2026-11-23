/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || RMA SO Type EditSave
 */
define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {
        return search.create({
            type: 'returnauthorization',
            settings: [{ name: 'consolidationtype', value: 'ACCTTYPE' }],
            filters: [
                ['type', 'anyof', 'RtnAuth'],
                'AND',
                ['mainline', 'is', 'T'],
                'AND',
                ['custbody_so_type_vs', 'isempty', ''],
                'AND',
                ['trandate', 'after', '29/08/2026'],
                'AND',
                ['status', 'anyof', 'RtnAuth:A']
            ],
            columns: [
                search.createColumn({ name: 'tranid', label: 'Document Number' }),
                search.createColumn({ name: 'transactionnumber', label: 'Transaction Number' }),
                search.createColumn({ name: 'trandate', label: 'Date' }),
                search.createColumn({ name: 'amount', label: 'Amount' }),
                search.createColumn({ name: 'custbody_so_type_vs', label: 'SO Type (Class)' })
            ]
        });
    }

    function map(context) {
        var result = JSON.parse(context.value);
        var rmaId = result.id;
        var tranId = result.values && result.values.tranid;

        try {
            var rec = record.load({
                type: record.Type.RETURN_AUTHORIZATION,
                id: rmaId,
                isDynamic: false
            });

            rec.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            context.write({ key: rmaId, value: 'SUCCESS' });
        } catch (e) {
            log.error('RMA save failed ' + rmaId + ' (' + tranId + ')', e);
            context.write({ key: rmaId, value: 'ERROR: ' + (e.message || e.toString()) });
        }
    }

    function summarize(summary) {
        var success = 0;
        var failed = 0;

        if (summary.inputSummary.error) {
            log.error('Input error', summary.inputSummary.error);
        }

        summary.mapSummary.errors.iterator().each(function (key, error) {
            failed++;
            log.error('Map error for RMA ' + key, error);
            return true;
        });

        summary.output.iterator().each(function (key, value) {
            if (value === 'SUCCESS') {
                success++;
            } else {
                failed++;
                log.error('RMA ' + key, value);
            }
            return true;
        });

        log.audit('RMA Edit/Save Summary', 'Saved: ' + success + ' | Failed: ' + failed);
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
});