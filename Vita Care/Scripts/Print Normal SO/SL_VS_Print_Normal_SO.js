/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Print Normal SO
 */
define(['N/record', 'N/render', 'N/file', 'N/config', 'N/url', 'N/xml', 'N/log'],
    function (record, render, file, config, url, xml, log) {

        // Change this to the real location of the template in the File Cabinet
        var TEMPLATE_PATH = 'SuiteScripts/Print_Normal_SO.xml';

        function onRequest(context) {
            try {

                var soId = context.request.parameters.soId;

                if (!soId) {
                    throw 'Missing soId';
                }

                var soRec = record.load({ type: record.Type.SALES_ORDER, id: soId });

                var templateFile = file.load({ id: TEMPLATE_PATH });

                var renderer = render.create();
                renderer.templateContent = templateFile.getContents();

                renderer.addRecord({ templateName: 'record', record: soRec });

                renderer.addCustomDataSource({
                    format: render.DataSource.OBJECT,
                    alias: 'companyInformation',
                    data: getCompanyInfo()
                });

                var pdf = renderer.renderAsPdf();
                pdf.name = 'Sales Order ' + soRec.getValue('tranid') + '.pdf';

                context.response.writeFile({ file: pdf, isInline: true });

            } catch (e) {

                log.error('Print Normal SO ERROR', e);
                context.response.write('Error: ' + e.toString());
            }
        }

        function getCompanyInfo() {

            var info = { companyName: '', addressText: '', logoUrl: '' };

            try {
                var cfg = config.load({ type: config.Type.COMPANY_INFORMATION });

                info.companyName = xml.escape({ xmlText: cfg.getValue('companyname') || '' });
                info.addressText = xml.escape({ xmlText: cfg.getValue('mainaddress_text') || '' });

                var logoId = cfg.getValue('pagelogo');

                if (logoId) {
                    var host = url.resolveDomain({ hostType: url.HostType.APPLICATION });
                    info.logoUrl = xml.escape({ xmlText: 'https://' + host + file.load({ id: logoId }).url });
                }

            } catch (e) {
                log.error('getCompanyInfo ERROR', e);
            }

            return info;
        }

        return {
            onRequest: onRequest
        };

    });