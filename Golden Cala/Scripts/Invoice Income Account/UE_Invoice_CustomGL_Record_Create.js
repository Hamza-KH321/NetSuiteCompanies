/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Invoice CustomGL Record Create
 */

define(['N/record', 'N/log'], function (record, log) {

    function afterSubmit(context) {
        try {

            log.debug('afterSubmit', 'Script Started');

            if (context.type == context.UserEventType.DELETE) {
                log.debug('Skipping Delete', 'Delete event detected');
                return;
            }

            var invoiceRecord = context.newRecord;
            var invoiceId = invoiceRecord.id;

            log.debug('invoiceId', invoiceId);

            var customGLAccount = invoiceRecord.getValue({ fieldId: 'custbody_vs_custom_gl_account' });
            var glImpactRecord = invoiceRecord.getValue({ fieldId: 'custbody_vs_gl_impact_record' });
            var approvalStatus = invoiceRecord.getValue({ fieldId: 'approvalstatus' });

            log.debug('customGLAccount', customGLAccount);
            log.debug('glImpactRecord', glImpactRecord);

            // if (!customGLAccount || glImpactRecord || approvalStatus != '2') {
            //     log.debug(
            //         'Stopping Script',
            //         'custbody_vs_custom_gl_account is empty OR custbody_vs_gl_impact_record already contains value OR Invoice is Not Approved'
            //     );
            //     return;
            // }

            var createdFrom = invoiceRecord.getValue({ fieldId: 'createdfrom' });
            var customGLAccount = invoiceRecord.getValue({ fieldId: 'custbody_vs_custom_gl_account' });

            log.debug('createdFrom', createdFrom);

            var glImpactRec = record.create({ type: 'customrecord_vs_invoice_gl_impact', isDynamic: true });

            glImpactRec.setValue({ fieldId: 'custrecord_vs_invoice_id', value: invoiceId });
            glImpactRec.setValue({ fieldId: 'custrecord_vs_custom_gl_account', value: customGLAccount });

            if (createdFrom) {
                glImpactRec.setValue({ fieldId: 'custrecord_vs_created_from', value: createdFrom });
            }

            var lineCount = invoiceRecord.getLineCount({ sublistId: 'item' });

            log.debug('lineCount', lineCount);

            for (var i = 0; i < lineCount; i++) {

                try {

                    var itemId = invoiceRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                    var quantity = invoiceRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });
                    var rate = invoiceRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i });
                    var tax = invoiceRecord.getSublistValue({ sublistId: 'item', fieldId: 'tax1amt', line: i });
                    var amount = invoiceRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i });

                    log.debug(
                        'Line Data',
                        {
                            line: i,
                            itemId: itemId,
                            quantity: quantity,
                            rate: rate,
                            tax: tax,
                            amount: amount
                        }
                    );

                    glImpactRec.selectNewLine({ sublistId: 'recmachcustrecord_vs_parent' });

                    glImpactRec.setCurrentSublistValue({ sublistId: 'recmachcustrecord_vs_parent', fieldId: 'custrecord_vs_item', value: itemId });
                    glImpactRec.setCurrentSublistValue({ sublistId: 'recmachcustrecord_vs_parent', fieldId: 'custrecord_vs_original_quantity', value: quantity });
                    glImpactRec.setCurrentSublistValue({ sublistId: 'recmachcustrecord_vs_parent', fieldId: 'custrecord_vs_original_rate', value: rate });
                    glImpactRec.setCurrentSublistValue({ sublistId: 'recmachcustrecord_vs_parent', fieldId: 'custrecord_vs_original_tax', value: tax });
                    glImpactRec.setCurrentSublistValue({ sublistId: 'recmachcustrecord_vs_parent', fieldId: 'custrecord_vs_original_amount', value: amount });
                    glImpactRec.setCurrentSublistValue({ sublistId: 'recmachcustrecord_vs_parent', fieldId: 'custrecord_vs_remaining_quantity', value: quantity });

                    glImpactRec.commitLine({ sublistId: 'recmachcustrecord_vs_parent' });

                } catch (lineErr) {

                    log.error(
                        'Line Error',
                        {
                            line: i,
                            error: lineErr
                        }
                    );
                }
            }

            var glImpactId = glImpactRec.save({ enableSourcing: true, ignoreMandatoryFields: true });

            log.debug('glImpactId', glImpactId);

            if (glImpactId) {

                record.submitFields({
                    type: record.Type.INVOICE,
                    id: invoiceId,
                    values: {
                        custbody_vs_gl_impact_record: glImpactId
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });

                log.debug(
                    'Invoice Updated',
                    'custbody_vs_gl_impact_record updated with ID: ' + glImpactId
                );
            }

            log.debug('afterSubmit', 'Script Completed');

        } catch (e) {

            log.error(
                'afterSubmit Error',
                e
            );
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});