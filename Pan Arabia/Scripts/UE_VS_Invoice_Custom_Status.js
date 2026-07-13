/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log', 'N/search'], function (record, log, search) {

    function afterSubmit(context) {
        try {
            var newRec = context.newRecord;

            // First "createdfrom" of Credit Memo
            var createdFromId = newRec.getValue('createdfrom');

            if (!createdFromId) {
                log.debug('No Created From', 'Credit Memo not created from an Invoice or RA');
                return;
            }

            log.debug('Created From', 'Internal ID: ' + createdFromId);

            var createdFromType = getTransactionType(createdFromId);

            log.debug('Created From Type', createdFromType);

            var invoiceIdToUpdate = null;

            if (createdFromType == 'invoice') {
                invoiceIdToUpdate = createdFromId;
            }

            else if (createdFromType == 'returnauthorization') {

                var raRec = record.load({
                    type: record.Type.RETURN_AUTHORIZATION,
                    id: createdFromId
                });

                var raCreatedFrom = raRec.getValue('createdfrom'); // this should be the Invoice

                if (!raCreatedFrom) {
                    log.debug('No Invoice Found', 'RA has no createdfrom');
                    return;
                }

                invoiceIdToUpdate = raCreatedFrom;
                log.debug('Invoice From RA', invoiceIdToUpdate);
            }

            else {
                log.debug('Unsupported Type', createdFromType);
                return;
            }

            var invoiceRec = record.load({type: record.Type.INVOICE,id: invoiceIdToUpdate});

            invoiceRec.setText({fieldId: 'custbody_vs_custom_status',text: 'Cancelled'});

            invoiceRec.save({ ignoreMandatoryFields: true });

            log.audit('Success', 'Invoice ' + invoiceIdToUpdate + ' updated to Cancelled');

        } catch (err) {
            log.error('Error in afterSubmit', err);
        }
    }

    function getTransactionType(internalId) {
        try {
            var transSearch = search.lookupFields({
                type: search.Type.TRANSACTION,
                id: internalId,
                columns: ['recordtype']
            });

            // NetSuite returns lowercase record type name
            return transSearch.recordtype;
        } catch (e) {
            log.error('Error in getTransactionType', e);
            return null;
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
