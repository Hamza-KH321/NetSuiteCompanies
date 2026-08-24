/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * @fileName Delivery Note
 */
define(['N/file', 'N/email', 'N/record', 'N/redirect', 'N/ui/serverWidget', 'N/render', 'N/search', 'N/https'],
    /**
     * @param {email} email
     * @param {record} record
     * @param {redirect} redirect
     * @param {serverWidget} serverWidget
     * @param {render} render
     * @param {file} file
     */
    function (file, email, record, redirect, serverWidget, render, search, https) {
        function onRequest(context) {
            try {

                var request = context.request;
                var response = context.response;
                var id1 = request.parameters.tranid;

                if (!id1) {
                    response.write('custom_id parameter missing');
                }

                var rec = record.load({
                    type: 'itemfulfillment',
                    id: id1,
                    isDynamic: true
                });

                var renderer = render.create();
                var template = file.load('SuiteScripts/DeliveryNoteXML.xml');

                renderer.templateContent = template.getContents();
                renderer.addRecord('record', rec);

                var xml = renderer.renderAsString();

                context.response.renderPdf(xml);

            } catch (err) {
                response.write(err + ' (line number: ' + err.lineno + ')');
                return;
            }
        }
        return {
            onRequest: onRequest
        };

    });