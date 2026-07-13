/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {

        var inventoryadjustmentSearchObj = search.create({
            type: "inventoryadjustment",
            settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
            filters: [
                ["type", "anyof", "InvAdjst"],
                "AND",
                ["mainline", "is", "T"],
                "AND",
                ["custbody_vs_source", "startswith", "Tes"]
            ],
            columns: [
                search.createColumn({ name: "tranid" }),
                search.createColumn({ name: "custbody_vs_source" }),
                search.createColumn({ name: "trandate" })
            ]
        });

        var transactionSearchObj = search.create({
            type: "transaction",
            settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
            filters: [
                ["mainline", "is", "T"],
                "AND",
                ["type", "anyof", "CuTrSale108"]
            ],
            columns: [
                search.createColumn({ name: "internalid" }),
                search.createColumn({ name: "tranid" }),
                search.createColumn({ name: "custbody_vs_inventoryadjustmentcreated" })
            ]
        });

        var inventoryAdjResults = [];
        inventoryadjustmentSearchObj.run().each(function (result) {
            inventoryAdjResults.push({
                source: result.getValue({ name: 'custbody_vs_source' })
            });
            return true;
        });

        var transactionResults = [];
        transactionSearchObj.run().each(function (result) {
            transactionResults.push({
                internalid: result.getValue({ name: 'internalid' }),
                tranid: result.getValue({ name: 'tranid' })
            });
            return true;
        });

        return transactionResults.map(function (tx) {
            return {
                tranid: tx.tranid,
                internalid: tx.internalid,
                allSources: inventoryAdjResults
            };
        });
    }

    function map(context) {
        try {
            var data = JSON.parse(context.value);
            var tranid = data.tranid;
            var internalid = data.internalid;
            var allSources = data.allSources;

            var hasAdjustment = allSources.some(function (src) {
                return src.source && src.source.trim() === ("Testers - " + tranid);
            });

            log.debug('Transaction Check', { tranid: tranid, hasAdjustment: hasAdjustment });

            if (!hasAdjustment) {

                var testersRec = record.load({ type: 'customsale_vs_foc_tt', id: internalid });
                var subsidiary = testersRec.getValue('subsidiary');
                var customer = testersRec.getValue('entity');
                var adjustmentAccount = 834;
                var location = testersRec.getValue('location');
                var date = testersRec.getValue('trandate');
                var itemCount = testersRec.getLineCount({ sublistId: 'item' });

                var inventoryAdjustment = record.create({
                    type: record.Type.INVENTORY_ADJUSTMENT,
                    isDynamic: true
                });

                inventoryAdjustment.setValue('subsidiary', subsidiary);
                if (customer) inventoryAdjustment.setValue('customer', customer);
                inventoryAdjustment.setValue('account', adjustmentAccount);
                inventoryAdjustment.setValue('trandate', date);
                inventoryAdjustment.setValue('adjlocation', location);

                for (var i = 0; i < itemCount; i++) {
                    
                    var itemId = testersRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                    var itemQty = testersRec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });
                    var invDetailSub = testersRec.getSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line: i });
                    var invDetailCount = invDetailSub.getLineCount({ sublistId: 'inventoryassignment' });

                    inventoryAdjustment.selectNewLine({ sublistId: 'inventory' });
                    inventoryAdjustment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'item', value: itemId });
                    inventoryAdjustment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'adjustqtyby', value: -itemQty });
                    inventoryAdjustment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'location', value: location });

                    var invDetail = inventoryAdjustment.getCurrentSublistSubrecord({ sublistId: 'inventory', fieldId: 'inventorydetail' });

                    for (var j = 0; j < invDetailCount; j++) {
                        invDetail.selectNewLine({ sublistId: 'inventoryassignment' });

                        var qty = invDetailSub.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', line: j });
                        var status = invDetailSub.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'status', line: j });
                        var issueNum = invDetailSub.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', line: j });
                        var expDate = invDetailSub.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'expirationdate', line: j });

                        invDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: -qty });
                        invDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'status', value: status });
                        invDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: issueNum });
                        invDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'expirationdate', value: expDate });

                        invDetail.commitLine({ sublistId: 'inventoryassignment' });
                    }

                    inventoryAdjustment.commitLine({ sublistId: 'inventory' });
                }

                inventoryAdjustment.setValue('custbody_vs_source', 'Testers - ' + tranid);
                var adjustmentId = inventoryAdjustment.save();
                log.audit('New Inventory Adjustment Created', { adjustmentId: adjustmentId, tranid: tranid });
            }
        } catch (err) {
            log.error('Map Error', err);

            try {
                var parsed = JSON.parse(context.value);
                var recordId = parsed.internalid;
                var testersRec = record.load({ type: 'customsale_vs_foc_tt', id: recordId });
                testersRec.setValue('custbody_vs_testers_error', JSON.stringify(err));
                testersRec.save();
            } catch (innerErr) {
                log.error('Failed to Save Error to Record', innerErr);
            }
        }
    }

    return {
        getInputData: getInputData,
        map: map
    };
});
