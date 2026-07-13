/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/record', 'N/log', 'N/search'], function (record, log, search) {

    function onRequest(scriptContext) {
        var request = scriptContext.request;
        var response = scriptContext.response;

        if (request.method !== 'POST') {
            return sendJsonResponse(response, {
                success: false,
                code: 'METHOD_NOT_ALLOWED',
                message: 'Use POST with JSON body.'
            });
        }

        try {
            var requestBody = {};
            try {
                requestBody = JSON.parse(request.body || '{}');
            } catch (parseErr) {
                log.error('JSON_PARSE_ERROR', parseErr);
                return sendErrorResponse(response, 'INVALID_JSON', 'Request body must be valid JSON.');
            }

            log.audit('Shoof Invoice API - Incoming Request', requestBody);

            if (!isNumericValue(requestBody.salesorderid)) {
                return sendErrorResponse(response, 'VALIDATION_ERROR', '"salesorderid" is mandatory and must be numeric.');
            }
            var salesOrderId = parseInt(requestBody.salesorderid, 10);

            var invoice = record.transform({
                fromType: record.Type.SALES_ORDER,
                fromId: salesOrderId,
                toType: record.Type.INVOICE,
                isDynamic: true
            });

            invoice.setValue({ fieldId: 'customform', value: 169 }); // Shoof Invoice
            invoice.setValue({ fieldId: 'approvalstatus', value: 2 });
            invoice.setValue({ fieldId: 'custbody_vs_shoof_transaction', value: true });

            var invoiceId = invoice.save({ enableSourcing: true, ignoreMandatoryFields: false });

            log.audit('INVOICE_CREATED', { internalId: invoiceId });

            var invoiceTranId = '';
            try {
                var lookup = search.lookupFields({
                    type: record.Type.INVOICE,
                    id: invoiceId,
                    columns: ['tranid']
                });
                invoiceTranId = (lookup && lookup.tranid) || '';
            } catch (lookupErr) {
                log.debug('TRANID_LOOKUP_WARNING', lookupErr);
            }

            return sendJsonResponse(response, {
                success: true,
                recordType: 'invoice',
                internalId: String(invoiceId),
                tranId: invoiceTranId,
                warnings: []
            });

        } catch (e) {
            log.error('SL_VS_Shoof_API_Invoice_UNEXPECTED_ERROR', {
                name: e.name || '',
                message: e.message || '',
                stack: e.stack || ''
            });
            return sendJsonResponse(response, {
                success: false,
                code: 'SERVER_ERROR',
                message: 'Unexpected error.',
                details: { name: e.name || '', message: e.message || '' }
            });
        }
    }

    function sendJsonResponse(response, body) {
        try { response.addHeader({ name: 'Content-Type', value: 'application/json' }); } catch (e) { }
        response.write(JSON.stringify(body));
    }

    function sendErrorResponse(response, code, message, details) {
        return sendJsonResponse(response, {
            success: false,
            code: code,
            message: message,
            details: details || {}
        });
    }

    function isNumericValue(value) {
        return value !== null && value !== '' && isFinite(parseFloat(value));
    }

    return { onRequest: onRequest };
});
