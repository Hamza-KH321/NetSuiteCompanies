/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Update TransferPrice TO
 */
define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {
        try {

            log.debug('getInputData', 'Start loading search');

            var transferorderSearchObj = search.create({
                type: "transferorder",
                settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "TrnfrOrd"],
                    "AND",
                    ["mainline", "is", "F"],
                    "AND",
                    ["taxline", "is", "F"],
                    "AND",
                    ["shipping", "is", "F"]
                ],
                columns: [
                    search.createColumn({ name: "internalid" }),
                    search.createColumn({ name: "line" }),
                    search.createColumn({ name: "item" }),
                    search.createColumn({ name: "internalid", join: "item" }),
                    search.createColumn({ name: "rate" }),
                    search.createColumn({ name: "transferprice", join: "item" })
                ]
            });

            return transferorderSearchObj;

        } catch (e) {
            log.error('getInputData Error', e);
        }
    }

    function map(context) {
        try {

            var result = JSON.parse(context.value);

            var transferOrderId = result.id;
            var itemId = result.values.item.value;
            var transferPrice = result.values['transferprice.item'];

            log.debug('Map Data', {
                transferOrderId: transferOrderId,
                itemId: itemId,
                transferPrice: transferPrice
            });

            // Skip if no transfer price
            if (!transferPrice) {
                log.debug('Skipped', 'No transfer price');
                return;
            }

            context.write({
                key: transferOrderId,
                value: {
                    itemId: itemId,
                    transferPrice: transferPrice
                }
            });

        } catch (e) {
            log.error('map Error', e);
        }
    }

    function reduce(context) {
        try {

            var transferOrderId = context.key;
            var values = context.values;

            log.debug('Reduce Start', 'TO ID: ' + transferOrderId);

            var rec = record.load({
                type: record.Type.TRANSFER_ORDER,
                id: transferOrderId,
                isDynamic: false
            });

            var lineCount = rec.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < values.length; i++) {
                try {

                    var data = JSON.parse(values[i]);

                    var itemId = data.itemId;
                    var transferPrice = data.transferPrice;

                    log.debug('Processing Item', {
                        itemId: itemId,
                        transferPrice: transferPrice
                    });

                    for (var j = 0; j < lineCount; j++) {

                        var currentItem = rec.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: j
                        });

                        if (currentItem == itemId) {

                            log.audit('Match Found', {
                                line: j,
                                itemId: itemId
                            });

                            rec.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'rate',
                                line: j,
                                value: parseFloat(transferPrice)
                            });

                            // NOTE:
                            // This will update ALL lines with same item
                            // If you want only one match, add break;

                        }
                    }

                } catch (lineErr) {
                    log.error('Line Error', lineErr);
                }
            }

            var recId = rec.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            log.debug('Record Saved', recId);

        } catch (e) {
            log.error('reduce Error', e);
        }
    }

    function summarize(summary) {
        try {

            log.debug('Summary', 'Execution completed');

            summary.mapSummary.errors.iterator().each(function (key, error) {
                log.error('Map Error for key: ' + key, error);
                return true;
            });

            summary.reduceSummary.errors.iterator().each(function (key, error) {
                log.error('Reduce Error for key: ' + key, error);
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