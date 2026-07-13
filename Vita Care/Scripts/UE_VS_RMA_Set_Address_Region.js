/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || RMA Set Address Region
 */
define(['N/record', 'N/log'], function (record, log) {

    function afterSubmit(context) {

        try {

            if (context.type == context.UserEventType.DELETE) {
                return;
            }

            var rmaRecord = context.newRecord;
            var rmaId = rmaRecord.id;

            log.debug('RMA ID', rmaId);

            var createdFrom = rmaRecord.getValue({
                fieldId: 'createdfrom'
            });

            log.debug('Created From', createdFrom);

            if (!createdFrom) {
                log.debug('Exit', 'Created From is empty');
                return;
            }

            var invoiceRecord = record.load({
                type: record.Type.INVOICE,
                id: createdFrom
            });

            var customerId = invoiceRecord.getValue({
                fieldId: 'entity'
            });

            var shipAddressList = invoiceRecord.getValue({
                fieldId: 'shipaddresslist'
            });

            log.debug('Customer ID', customerId);
            log.debug('Ship Address List', shipAddressList);

            if (!customerId || !shipAddressList) {
                log.debug('Exit', 'Customer or Ship Address List is empty');
                return;
            }

            var customerRecord = record.load({
                type: record.Type.CUSTOMER,
                id: customerId
            });

            var addressCount = customerRecord.getLineCount({
                sublistId: 'addressbook'
            });

            log.debug('Address Count', addressCount);

            var zone = '';

            for (var i = 0; i < addressCount; i++) {

                var addressId = customerRecord.getSublistValue({
                    sublistId: 'addressbook',
                    fieldId: 'id',
                    line: i
                });

                log.debug('Address ID Line ' + i, addressId);

                if (String(addressId) == String(shipAddressList)) {

                    log.debug('Matching Address Found', addressId);

                    var addressSubrecord = customerRecord.getSublistSubrecord({
                        sublistId: 'addressbook',
                        fieldId: 'addressbookaddress',
                        line: i
                    });

                    zone = addressSubrecord.getValue({
                        fieldId: 'custrecord_zone'
                    });

                    log.debug('Zone Value', zone);

                    break;
                }
            }

            if (!zone) {
                log.debug('Exit', 'Zone not found');
                return;
            }

            record.submitFields({
                type: record.Type.RETURN_AUTHORIZATION,
                id: rmaId,
                values: {
                    custbody_vs_rma_region_approval: zone
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });

            log.debug('Success', 'Region updated on RMA');

        } catch (e) {

            log.error({
                title: 'afterSubmit Error',
                details: e
            });

        }
    }

    return {
        afterSubmit: afterSubmit
    };

});