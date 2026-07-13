/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/file', 'N/render', 'N/record', 'N/log'],
    (file, render, record, log) => {

        function onRequest(context) {
            try {
                const request = context.request;
                const recordId = request.parameters.recordId;

                log.debug('recordId', recordId);

                if (!recordId) {
                    context.response.write('Missing record ID');
                    return;
                }

                const xmlFile = file.load({ id: 1264 });

                const renderer = render.create();
                renderer.templateContent = xmlFile.getContents();

                renderer.addRecord('record', record.load({ type: record.Type.TRANSFER_ORDER, id: recordId }));

                const pdfFile = renderer.renderAsPdf();
                context.response.writeFile(pdfFile, true);

            } catch (e) {
                log.error('Error rendering Transfer Order', e);
                context.response.write('Error: ' + e.message);
            }
        }

        return { onRequest };
    });
