/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Print SO
 */
define(['N/log', 'N/record', 'N/file'], function (log, record, file) {

    function onRequest(context) {
        try {
            log.debug('onRequest', 'Start');

            var request = context.request;
            var response = context.response;

            var soId = request.parameters.soId;

            log.debug('Sales Order ID', soId);

            if (!soId) {
                response.write('Missing Sales Order ID');
                return;
            }

            var soRec = record.load({
                type: record.Type.SALES_ORDER,
                id: soId
            });

            var tranId = soRec.getValue('tranid');

            log.debug('tranId', tranId);

            var xmlFile = file.load({ id: 'SuiteScripts/XMLTemplates/SOForm.xml' });
            var xmlContent = xmlFile.getContents();

            log.debug('Original XML Template', xmlContent);

            xmlContent = xmlContent.replace('{{TRAN_ID}}', tranId);

            log.debug('Final XML', xmlContent);

            response.setHeader({
                name: 'Content-Type',
                value: 'application/xml'
            });

            response.setHeader({
                name: 'Content-Disposition',
                value: 'inline; filename="SO_' + tranId + '.xml"'
            });

            response.write(xmlContent);

        } catch (e) {
            log.error('Error in Suitelet', e);
            context.response.write('Error: ' + e.message);
        }
    }

    return {
        onRequest: onRequest
    };

});