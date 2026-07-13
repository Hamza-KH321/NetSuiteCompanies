/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
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
                log.debug('id1', id1);

                if (!id1) {
                    response.write('custom_id parameter missing');
                }

                var rec = record.load({
                    type: 'customerpayment',
                    id: id1,
                    isDynamic: true
                });
                log.debug('rec', rec);


                var renderer = render.create();
                var template = file.load('SuiteScripts/customerpayment.xml');
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