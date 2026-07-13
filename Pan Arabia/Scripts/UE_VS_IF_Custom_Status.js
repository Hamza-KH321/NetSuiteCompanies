/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE_UpdateIFStatus_FromCreditMemo.js
 */

define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function afterSubmit(context) {

        try {

            if (context.type != context.UserEventType.CREATE && context.type != context.UserEventType.EDIT) {
                return;
            }

            var newRec = context.newRecord;
            var creditMemoId = newRec.id;

            log.debug('Credit Memo ID', creditMemoId);

            var createdFromId = newRec.getValue({ fieldId: 'createdfrom' });

            if (!createdFromId) {
                log.debug('No Created From Found', 'Exit Script');
                return;
            }

            log.debug('Created From ID', createdFromId);

            var creditMemoType = getTransactionType(creditMemoId);
            log.debug('Credit Memo Info', 'ID: ' + creditMemoId + ' | Type: ' + creditMemoType);

            var createdFromType = getTransactionType(createdFromId);
            log.debug('Created From Info', 'ID: ' + createdFromId + ' | Type: ' + createdFromType);

            // 🔎 Resolve Sales Order (multi-level traversal)
            var salesOrderId = resolveSalesOrder(createdFromId);

            if (!salesOrderId) {
                log.debug('Sales Order Not Found', 'Exit Script');
                return;
            }

            log.debug('Final Sales Order ID', salesOrderId);

            // 🔎 Get all Item Fulfillments using applyingtransaction join

            var salesorderSearchObj = search.create({
                type: "salesorder",
                settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "SalesOrd"],
                    "AND",
                    ["internalid", "anyof", salesOrderId],
                    "AND",
                    ["applyingtransaction.type", "anyof", "ItemShip"]
                ],
                columns: [
                    search.createColumn({
                        name: "internalid",
                        join: "applyingTransaction"
                    })
                ]
            });

            salesorderSearchObj.run().each(function (result) {

                try {

                    var ifId = result.getValue({
                        name: "internalid",
                        join: "applyingTransaction"
                    });

                    log.debug('Updating Item Fulfillment', ifId);

                    if (ifId) {

                        record.submitFields({
                            type: record.Type.ITEM_FULFILLMENT,
                            id: ifId,
                            values: {
                                custbody_vs_if_custom_status: 'Cancelled'
                            },
                            options: {
                                enableSourcing: false,
                                ignoreMandatoryFields: true
                            }
                        });

                    }

                } catch (innerError) {

                    log.error('Error Updating IF', innerError);

                }

                return true;
            });

            log.debug('Process Completed', 'All IF updated');

        } catch (e) {

            log.error('Error in afterSubmit', e);

        }
    }


    // 🔎 Traverses until Sales Order is found
    function resolveSalesOrder(startId) {

        try {

            var currentId = startId;
            var safetyCounter = 0;

            while (currentId && safetyCounter < 5) {

                safetyCounter++;

                var currentType = getTransactionType(currentId);

                log.debug('Traversing Transaction',
                    'ID: ' + currentId + ' | Type: ' + currentType
                );

                if (currentType == 'SalesOrd') {
                    return currentId;
                }

                var lookup = search.lookupFields({
                    type: search.Type.TRANSACTION,
                    id: currentId,
                    columns: ['createdfrom']
                });

                if (lookup && lookup.createdfrom && lookup.createdfrom.length > 0) {
                    currentId = lookup.createdfrom[0].value;
                } else {
                    return null;
                }

            }

            return null;

        } catch (e) {

            log.error('Error Resolving Sales Order', e);
            return null;

        }
    }


    function getTransactionType(internalId) {

        try {

            var lookup = search.lookupFields({
                type: search.Type.TRANSACTION,
                id: internalId,
                columns: ['type']
            });

            if (lookup && lookup.type && lookup.type.length > 0) {
                return lookup.type[0].value;
            }

            return 'Unknown';

        } catch (e) {

            log.error('Error Getting Transaction Type for ID ' + internalId, e);
            return 'Error';

        }
    }


    return {
        afterSubmit: afterSubmit
    };

});