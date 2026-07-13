/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Consignment Price Level Update
 */
define(['N/record', 'N/log'], function (record, log) {

    function afterSubmit(context) {
        try {

            log.debug('START', 'Script Started');

            if (context.type != context.UserEventType.CREATE && context.type != context.UserEventType.EDIT) {
                log.debug('EXIT', 'Not create or edit');
                return;
            }

            var rec = context.newRecord;
            var recId = rec.id;
            var recType = rec.type;

            var isConsignment = rec.getValue({
                fieldId: 'custbody_vs_consignment_order'
            });

            log.debug('Checkbox Value', isConsignment);

            if (!isConsignment) {
                log.debug('EXIT', 'Checkbox not checked');
                return;
            }

            var loadedRec = record.load({
                type: recType,
                id: recId,
                isDynamic: true
            });

            var lineCount = loadedRec.getLineCount({
                sublistId: 'item'
            });

            log.debug('Line Count', lineCount);

            for (var i = lineCount - 1; i >= 0; i--) {

                try {

                    loadedRec.selectLine({
                        sublistId: 'item',
                        line: i
                    });

                    loadedRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'price',
                        value: 22
                    });

                    var rate = loadedRec.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate'
                    });

                    log.debug('Line Rate', 'Line: ' + i + ' | Rate: ' + rate);

                    if (!rate || parseFloat(rate) == 0) {

                        log.debug('Removing Line', 'Line: ' + i);

                        loadedRec.removeLine({
                            sublistId: 'item',
                            line: i
                        });

                        continue;
                    }

                    loadedRec.commitLine({
                        sublistId: 'item'
                    });

                    log.debug('Line Updated', 'Line: ' + i);

                } catch (lineError) {
                    log.error('LINE ERROR', 'Line: ' + i + ' | Error: ' + lineError);
                }
            }

            var savedId = loadedRec.save();

            log.debug('SUCCESS', 'Record Saved: ' + savedId);

        } catch (e) {
            log.error('ERROR', e);
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});