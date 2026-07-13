/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Apply Invoice Credit Memo
 */
define(['N/record', 'N/log'], function (record, log) {

    function afterSubmit(context) {
        try {

            if (context.type != context.UserEventType.CREATE &&
                context.type != context.UserEventType.EDIT) {
                return;
            }

            var creditMemo = context.newRecord;

            var customGLImpact = creditMemo.getValue({
                fieldId: 'custbody_vs_custom_gl_impact'
            });

            log.debug('Custom GL Impact', customGLImpact);

            if (!customGLImpact) {
                return;
            }

            var createdFromText = creditMemo.getText({
                fieldId: 'createdfrom'
            });

            log.debug('Created From Text', createdFromText);

            if (!createdFromText) {
                return;
            }

            var invoiceNumber = createdFromText
                .replace('Invoice #', '')
                .trim();

            log.debug('Invoice Number', invoiceNumber);

            var cmRec = record.load({
                type: record.Type.CREDIT_MEMO,
                id: creditMemo.id,
                isDynamic: true
            });

            var lineCount = cmRec.getLineCount({
                sublistId: 'apply'
            });

            log.debug('Apply Line Count', lineCount);

            for (var i = 0; i < lineCount; i++) {

                var refNum = cmRec.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'refnum',
                    line: i
                });

                log.debug('Checking Line', {
                    line: i,
                    refNum: refNum
                });

                if (refNum == invoiceNumber) {

                    cmRec.selectLine({
                        sublistId: 'apply',
                        line: i
                    });

                    cmRec.setCurrentSublistValue({
                        sublistId: 'apply',
                        fieldId: 'apply',
                        value: true
                    });

                    cmRec.commitLine({
                        sublistId: 'apply'
                    });

                    log.debug('Invoice Applied', invoiceNumber);

                    break;
                }
            }

            var creditMemoId = cmRec.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            log.debug('Credit Memo Saved', creditMemoId);

        } catch (e) {
            log.error('afterSubmit Error', e);
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});