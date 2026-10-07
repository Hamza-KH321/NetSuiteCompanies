/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Inactivate SHF Items
 */

define(['N/search', 'N/record', 'N/log'], function(search, record, log) {

    function getInputData() {
        try {
            log.audit({
                title: 'getInputData Started',
                details: 'Loading active SHF items'
            });

            var itemSearchObj = search.create({
                type: 'item',
                filters: [
                    ['name', 'startswith', 'SHF'],
                    // 'AND',
                    // ['isinactive', 'is', 'F']
                ],
                columns: [
                    search.createColumn({
                        name: 'internalid',
                        label: 'Internal ID'
                    }),
                    search.createColumn({
                        name: 'itemid',
                        label: 'Name'
                    }),
                    search.createColumn({
                        name: 'custitem_vs_sku',
                        label: 'SKU Code'
                    }),
                    search.createColumn({
                        name: 'isinactive',
                        label: 'Inactive'
                    })
                ]
            });

            return itemSearchObj;

        } catch (e) {
            log.error({
                title: 'getInputData Error',
                details: e
            });

            throw e;
        }
    }

    function map(context) {
        try {
            log.audit({
                title: 'Map Started',
                details: context.value
            });

            var searchResult = JSON.parse(context.value);

            var itemId = searchResult.id;
            var itemName = searchResult.values.itemid;
            var skuCode = searchResult.values.custitem_vs_sku;

            log.audit({
                title: 'Processing Item',
                details: {
                    internalId: itemId,
                    itemName: itemName,
                    skuCode: skuCode
                }
            });

            if (!itemId || !itemName) {
                log.error({
                    title: 'Missing Item Information',
                    details: context.value
                });

                return;
            }

            var newItemName = itemName + '-INACTIVE';
            var newSkuCode = '';

            if (skuCode) {
                newSkuCode = skuCode + '_INACTIVE';
            }

            log.audit({
                title: 'Updating Item',
                details: {
                    internalId: itemId,
                    oldItemName: itemName,
                    newItemName: newItemName,
                    oldSkuCode: skuCode,
                    newSkuCode: newSkuCode,
                    inactive: true
                }
            });

            record.submitFields({
                type: record.Type.INVENTORY_ITEM,
                id: itemId,
                values: {
                    itemid: newItemName,
                    custitem_vs_sku: newSkuCode,
                    isinactive: true
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });

            log.audit({
                title: 'Item Updated Successfully',
                details: {
                    internalId: itemId,
                    oldItemName: itemName,
                    newItemName: newItemName,
                    oldSkuCode: skuCode,
                    newSkuCode: newSkuCode
                }
            });

        } catch (e) {
            log.error({
                title: 'Map Error',
                details: {
                    error: e,
                    context: context.value
                }
            });

            throw e;
        }
    }

    function reduce(context) {
        try {
            log.debug({
                title: 'Reduce Started',
                details: context.key
            });

        } catch (e) {
            log.error({
                title: 'Reduce Error',
                details: e
            });

            throw e;
        }
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce
    };
});