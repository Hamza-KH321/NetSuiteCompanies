/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Print Requisition Label
 */
define(['N/log', 'N/file', 'N/render', 'N/record'], function (log, file, render, record) {

    function onRequest(context) {
        try {
            log.debug('onRequest', 'Suitelet called');

            var recordId = context.request.parameters.recordId;
            var recordType = context.request.parameters.recordType;

            log.debug('Record Params', recordType + ' | ' + recordId);

            var rec = record.load({
                type: recordType,
                id: recordId
            });

            var xmlFile = file.load({
                id: 'SuiteScripts/LabelTemplates/Requisition_Label_Template.xml'
            });

            var renderer = render.create();
            renderer.templateContent = xmlFile.getContents();

            renderer.addRecord({
                templateName: 'record',
                record: rec
            });

            var pdfFile = renderer.renderAsPdf();

            context.response.writeFile({
                file: pdfFile,
                isInline: true
            });

        } catch (e) {
            log.error('Suitelet error', e);
            context.response.write('PDF generation failed. Check logs.');
        }
    }

    return {
        onRequest: onRequest
    };
});
