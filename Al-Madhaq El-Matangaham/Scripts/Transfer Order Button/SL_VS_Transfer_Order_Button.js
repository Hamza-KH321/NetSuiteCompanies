/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Transfer Order Button
 */
define(['N/record', 'N/log', 'N/ui/serverWidget', 'N/redirect'], function (record, log, serverWidget, redirect) {

    function onRequest(context) {
        try {
            log.debug('Suitelet Triggered', context.request.parameters);

            var requisitionId = context.request.parameters.requisitionId;

            if (!requisitionId) {
                throw 'Missing requisition ID';
            }

            var requisition = record.load({
                type: record.Type.PURCHASE_REQUISITION,
                id: requisitionId,
                isDynamic: false
            });

            var fromLocation = requisition.getValue('custbody_vs_from_location');
            var toLocation = requisition.getValue('location');
            var subsidiary = requisition.getValue('subsidiary');

            log.debug('Locations', {
                fromLocation: fromLocation,
                toLocation: toLocation,
                subsidiary: subsidiary
            });

            if (!fromLocation || !toLocation) {
                showAlert(context, 'Please fill From Location and To Location to create Transfer Order.');
                return;
            }

            var items = [];
            var lineCount = requisition.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < lineCount; i++) {

                var createTO = requisition.getSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_create_transfer_order', line: i });
                var alreadyCreated = requisition.getSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_to_created', line: i });

                if (createTO && !alreadyCreated) {
                    items.push({
                        line: i,
                        item: requisition.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i }),
                        quantity: requisition.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i })
                    });
                }
            }

            if (items.length === 0) {
                showAlert(context, 'No eligible lines found to create Transfer Order.');
                return;
            }

            // Create Transfer Order
            var transferOrder = record.create({
                type: record.Type.TRANSFER_ORDER,
                isDynamic: true
            });

            transferOrder.setValue('subsidiary', subsidiary);
            transferOrder.setValue('orderstatus', 'B');
            transferOrder.setValue('location', fromLocation);
            transferOrder.setValue('transferlocation', toLocation);
            transferOrder.setValue('custbody_vs_requisition_refernece', requisitionId);

            for (var j = 0; j < items.length; j++) {
                transferOrder.selectNewLine({ sublistId: 'item' });
                transferOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: items[j].item });
                transferOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: items[j].quantity });
                transferOrder.commitLine({ sublistId: 'item' });
            }

            var transferOrderId = transferOrder.save();

            log.debug('Transfer Order Created', transferOrderId);

            // Update Requisition Lines
            requisition = record.load({
                type: record.Type.PURCHASE_REQUISITION,
                id: requisitionId,
                isDynamic: false
            });

            requisition.setValue('custbody_vs_to_created', true);

            for (var k = 0; k < items.length; k++) {
                requisition.setSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_to_created', line: items[k].line, value: true });
                requisition.setSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_transfer_order_reference', line: items[k].line, value: transferOrderId });
                requisition.setSublistValue({ sublistId: 'item', fieldId: 'isclosed', line: items[k].line, value: true });
            }

            requisition.save();

            showAlert(context, 'Transfer Order created successfully.');

            redirect.toRecord({
                type: record.Type.PURCHASE_REQUISITION,
                id: requisitionId
            });

        } catch (e) {
            log.error('Suitelet Error', e);
            showAlert(context, e.toString());
        }
    }

    function showAlert(context, message) {
        var form = serverWidget.createForm({ title: 'Message' });
        form.addField({
            id: 'custpage_msg',
            type: serverWidget.FieldType.INLINEHTML,
            label: ' '
        }).defaultValue =
            '<script>alert("' + message + '"); window.history.back();</script>';

        context.response.writePage(form);
    }

    return {
        onRequest: onRequest
    };
});
