/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Consignment TO IF
 */
define(['N/record', 'N/log'], function (record, log) {

    function afterSubmit(context) {
        try {
            if (context.type !== context.UserEventType.CREATE &&
                context.type !== context.UserEventType.EDIT) {
                return;
            }

            var toRec = context.newRecord;
            var toId = toRec.id;

            var isConsignment = toRec.getValue({ fieldId: 'custbody_vs_consignment_to' });
            var ifCreated = toRec.getValue({ fieldId: 'custbody_vs_itemfulfillment_created' });

            var consignmentChecked = (isConsignment === true || isConsignment === 'T');
            var ifCreatedChecked = (ifCreated === true || ifCreated === 'T');

            if (!consignmentChecked || ifCreatedChecked) {
                return;
            }

            var currentStatus = toRec.getValue({ fieldId: 'orderstatus' });
            if (currentStatus !== 'B') {
                record.submitFields({
                    type: record.Type.TRANSFER_ORDER,
                    id: toId,
                    values: { orderstatus: 'B' },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true,
                        disableTriggers: true
                    }
                });
            }

            var ifRec = record.transform({
                fromType: record.Type.TRANSFER_ORDER,
                fromId: toId,
                toType: record.Type.ITEM_FULFILLMENT,
                isDynamic: false
            });

            ifRec.setValue({ fieldId: 'shipstatus', value: 'C' });
            ifRec.setValue({ fieldId: 'custbody_vs_consignment_to_reference', value: toId });

            var ifId = ifRec.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            record.submitFields({
                type: record.Type.TRANSFER_ORDER,
                id: toId,
                values: {
                    custbody_vs_itemfulfillment_created: true,
                    custbody_vs_consignment_if: ifId
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                }
            });

            log.audit('Consignment TO IF', 'Item Fulfillment ' + ifId + ' created for Transfer Order ' + toId);
        } catch (e) {
            log.error('Consignment TO IF - afterSubmit', e.name + ': ' + e.message);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});