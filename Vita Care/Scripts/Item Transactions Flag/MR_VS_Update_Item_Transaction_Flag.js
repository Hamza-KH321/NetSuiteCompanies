/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Update Item Transaction Flag
 */
define(['N/search', 'N/record', 'N/log'],
    function (search, record, log) {

        function getInputData() {
            try {
                log.debug('getInputData', 'Loading transaction search');

                return search.create({
                    type: 'transaction',
                    settings: [
                        {
                            name: 'consolidationtype',
                            value: 'ACCTTYPE'
                        }
                    ],
                    filters: [
                        ['item', 'noneof', '@NONE@'],
                        'AND',
                        ['mainline', 'is', 'T'],
                        // 'AND',
                        // ['item', 'anyof', '7373']
                    ],
                    columns: [
                        search.createColumn({ name: 'item', summary: 'GROUP' }),
                        search.createColumn({ name: 'internalid', join: 'item', summary: 'GROUP' }),
                        search.createColumn({ name: 'type', join: 'item', summary: 'GROUP' }),
                        search.createColumn({ name: 'islotitem', join: 'item', summary: 'GROUP' }),
                        search.createColumn({ name: 'isserialitem', join: 'item', summary: 'GROUP' }),
                        search.createColumn({ name: 'tranid', summary: 'COUNT' })
                    ]
                });

            } catch (e) {
                log.error('getInputData Error', e);
            }
        }

        function map(context) {
            try {
                log.debug('map Context', context.value);

                var result = JSON.parse(context.value);

                var itemId = result.values['GROUP(internalid.item)'].value;
                var transactionCount = parseInt(result.values['COUNT(tranid)'], 10) || 0;
                var itemType = result.values['GROUP(type.item)'].value;
                var isLotItem = result.values['GROUP(islotitem.item)'] == 'T';
                var isSerializedItem = result.values['GROUP(isserialitem.item)'] == 'T';

                log.debug('Item Details', {
                    itemId: itemId,
                    itemType: itemType,
                    isLotItem: isLotItem,
                    isSerializedItem: isSerializedItem,
                    transactionCount: transactionCount
                });

                if (transactionCount <= 0) {
                    log.debug('Skipping Item', 'No transactions found for Item ID: ' + itemId);
                    return;
                }

                var recordType = '';

                switch (itemType) {

                    case 'InvtPart':
                        if (isLotItem) {
                            recordType = record.Type.LOT_NUMBERED_INVENTORY_ITEM;
                        } else if (isSerializedItem) {
                            recordType = record.Type.SERIALIZED_INVENTORY_ITEM;
                        } else {
                            recordType = record.Type.INVENTORY_ITEM;
                        }
                        break;

                    case 'Assembly':
                        if (isLotItem) {
                            recordType = record.Type.LOT_NUMBERED_ASSEMBLY_ITEM;
                        } else if (isSerializedItem) {
                            recordType = record.Type.SERIALIZED_ASSEMBLY_ITEM;
                        } else {
                            recordType = record.Type.ASSEMBLY_ITEM;
                        }
                        break;

                    case 'NonInvtPart':
                        recordType = record.Type.NON_INVENTORY_ITEM;
                        break;

                    case 'Service':
                        recordType = record.Type.SERVICE_ITEM;
                        break;

                    case 'Kit':
                        recordType = record.Type.KIT_ITEM;
                        break;

                    case 'Group':
                        recordType = record.Type.ITEM_GROUP;
                        break;

                    case 'Discount':
                        recordType = record.Type.DISCOUNT_ITEM;
                        break;

                    case 'Markup':
                        recordType = record.Type.MARKUP_ITEM;
                        break;

                    case 'OthCharge':
                        recordType = record.Type.OTHER_CHARGE_ITEM;
                        break;

                    case 'Payment':
                        recordType = record.Type.PAYMENT_ITEM;
                        break;

                    case 'Subtotal':
                        recordType = record.Type.SUBTOTAL_ITEM;
                        break;

                    case 'GiftCert':
                        recordType = record.Type.GIFT_CERTIFICATE_ITEM;
                        break;

                    default:
                        log.error('Unsupported Item Type', itemType);
                        return;
                }

                log.debug('Record Type', recordType);

                record.submitFields({
                    type: recordType,
                    id: itemId,
                    values: {
                        custitem_vs_contain_transactions: true
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });

                log.audit('Item Updated', {
                    itemId: itemId,
                    recordType: recordType,
                    transactionCount: transactionCount
                });

            } catch (e) {
                log.error('Map Error', e);
            }
        }

        return {
            getInputData: getInputData,
            map: map
        };

    });