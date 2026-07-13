/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function (record, log) {
    function afterSubmit(context) {
        try {
            var rec = record.load({
                type: context.newRecord.type,
                id: context.newRecord.id,
                isDynamic: false
            });

            var lineCount = rec.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < lineCount; i++) {
                var inventoryDetail;
                try {
                    inventoryDetail = rec.getSublistSubrecord({
                        sublistId: 'item',
                        fieldId: 'inventorydetail',
                        line: i
                    });
                } catch (e) {
                    // inventorydetail might not exist on this line
                    continue;
                }

                var lotLines = [];

                if (inventoryDetail) {
                    var inventoryAssignmentCount = inventoryDetail.getLineCount({ sublistId: 'inventoryassignment' });

                    for (var j = 0; j < inventoryAssignmentCount; j++) {
                        var lotNumber = inventoryDetail.getSublistText({
                            sublistId: 'inventoryassignment',
                            fieldId: 'issueinventorynumber',
                            line: j
                        });

                        var expirationDate = inventoryDetail.getSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'expirationdate',
                            line: j
                        });

                        lotLines.push({
                            lotNumber: lotNumber || '',
                            expirationDate: expirationDate || ''
                        });
                    }
                }

                rec.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_vs_inventory_details_json',
                    line: i,
                    value: JSON.stringify(lotLines)
                });
            }

            rec.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });

        } catch (error) {
            log.error('ERROR in afterSubmit', error);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
