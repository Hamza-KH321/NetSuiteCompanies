/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Case Customer Region
 */

define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function beforeSubmit(context) {

        try {

            log.debug('beforeSubmit', 'Script Started');

            var caseRecord = context.newRecord;
            var caseId = caseRecord.id;

            log.debug('caseId', caseId);

            var customerId = caseRecord.getValue({
                fieldId: 'company'
            });

            log.debug('customerId', customerId);

            if (!customerId) {

                log.debug('No Customer', 'Company field is empty');
                return;
            }

            var customerLookup = search.lookupFields({
                type: search.Type.CUSTOMER,
                id: customerId,
                columns: ['custentitycus_reg_id_001']
            });

            log.debug('customerLookup', customerLookup);

            var regionValue = '';

            if (customerLookup.custentitycus_reg_id_001 && customerLookup.custentitycus_reg_id_001.length > 0) {

                regionValue = customerLookup.custentitycus_reg_id_001[0].value;
            }

            log.debug('regionValue', regionValue);

            if (!regionValue) {

                log.debug('No Region', 'Customer region is empty');
                return;
            }

            record.submitFields({
                type: record.Type.SUPPORT_CASE,
                id: caseId,
                values: {
                    custevent_vs_customer_region: regionValue
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });

            log.debug('Success', 'Case updated successfully');

        } catch (e) {

            log.error('beforeSubmit Error', e);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});