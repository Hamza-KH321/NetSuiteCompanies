/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * @fileName SL || Delivery Note Print
 */

define(['N/file', 'N/record', 'N/render',], function (file, record, render,) {

    function onRequest(context) {
        try {

            var request = context.request;
            var response = context.response;
            var id1 = request.parameters.tranid;

            if (!id1) {
                log.error('Missing tranid', 'tranid parameter is missing');
                response.write('custom_id parameter missing');
                return;
            }

            var rec = record.load({
                type: 'itemfulfillment',
                id: id1,
                isDynamic: true
            });

            var renderer = render.create();
            var template = file.load({ id: 'SuiteScripts/DeliveryNoteXML.xml' });

            renderer.templateContent = template.getContents();

            renderer.addRecord('record', rec);

            var xml = renderer.renderAsString();

            context.response.renderPdf(xml);

            log.debug('Delivery Note PDF generated', {
                internalId: id1
            });

        } catch (e) {

            log.error('Error in Delivery Note Suitelet', {
                name: e.name,
                message: e.message,
                stack: e.stack
            });

            context.response.write(
                e + ' (line number: ' + e.lineno + ')'
            );
        }
    }

    return {
        onRequest: onRequest
    };
});