/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * Prints an Invoice to a PrintNode printer on CREATE.
 *
 * Deployment:
 *   - Record:        Invoice
 *   - Event Type:    Create
 *   - Execute As:    Administrator (recommended for https + N/render)
 *
 * NOTE: API key & printer ID are hardcoded for testing only.
 *       Move them to script parameters before going to production.
 */
define(['N/https', 'N/encode', 'N/render', 'N/record', 'N/search', 'N/log'],
    function (https, encode, render, record, search, log) {

        // -------- HARDCODED CONFIG (testing) --------
        var PRINTNODE_API_KEY = 'Coac-5cPYmLBJN4uUaHghc3ZDkUlozK4Yvoxdy6bflA';
        var PRINTER_ID = 75404329; // Canon G3030 series
        // --------------------------------------------

        function afterSubmit(context) {
            // Only run on CREATE
            if (context.type !== context.UserEventType.CREATE) {
                return;
            }

            try {
                var invoiceId = context.newRecord.id;
                log.audit('PrintNode', 'Starting print job for invoice ' + invoiceId);

                // 1. Load invoice with all needed fields
                var invoice = record.load({
                    type: record.Type.INVOICE,
                    id: invoiceId
                });

                // 2. Build a data object for the PDF
                var data = buildInvoiceData(invoice);

                // 3. Render HTML -> PDF (returns N/file.File)
                var pdfFile = renderInvoicePdf(data);

                // 4. Get base64 contents of the PDF
                var pdfBase64 = pdfFile.getContents(); // already base64 for binary files

                // 5. Send to PrintNode
                sendToPrintNode(pdfBase64, 'Invoice ' + data.invoiceNumber);

                log.audit('PrintNode', 'Print job submitted for invoice ' + invoiceId);

            } catch (e) {
                log.error('PrintNode error', e);
            }
        }

        /* -------------------------------------------------- *
         *  Build a clean JS object from the invoice record   *
         * -------------------------------------------------- */
        function buildInvoiceData(invoice) {
            var customerName = invoice.getText({ fieldId: 'entity' }) || '';
            var tranDate = invoice.getText({ fieldId: 'trandate' }) || '';
            var invoiceNum = invoice.getValue({ fieldId: 'tranid' }) || '';
            var subtotal = Number(invoice.getValue({ fieldId: 'subtotal' }) || 0);
            var taxTotal = Number(invoice.getValue({ fieldId: 'taxtotal' }) || 0);
            var total = Number(invoice.getValue({ fieldId: 'total' }) || 0);

            // Location text (optional field)
            var locationName = '';
            try {
                locationName = invoice.getText({ fieldId: 'location' }) || '';
            } catch (e) { /* field may not be present */ }

            // Customer shipping/billing address (use billing here)
            var billAddress = '';
            try {
                billAddress = invoice.getValue({ fieldId: 'billaddress' }) || '';
            } catch (e) { /* ignore */ }

            // Items
            var items = [];
            var lineCount = invoice.getLineCount({ sublistId: 'item' });
            for (var i = 0; i < lineCount; i++) {
                items.push({
                    item: invoice.getSublistText({ sublistId: 'item', fieldId: 'item', line: i }) || '',
                    quantity: Number(invoice.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }) || 0),
                    rate: Number(invoice.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i }) || 0),
                    amount: Number(invoice.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }) || 0)
                });
            }

            return {
                invoiceNumber: invoiceNum,
                customerName: customerName,
                tranDate: tranDate,
                location: locationName,
                billAddress: billAddress,
                items: items,
                subtotal: subtotal,
                taxTotal: taxTotal,
                total: total
            };
        }

        /* -------------------------------------------------- *
         *  Render HTML template into a PDF file              *
         * -------------------------------------------------- */
        function renderInvoicePdf(data) {
            var renderer = render.create();

            var xml = buildXmlTemplate(data);
            renderer.templateContent = xml;

            return renderer.renderAsPdf(); // returns N/file.File
        }

        /* -------------------------------------------------- *
         *  Build the BFO/FreeMarker XML for the PDF          *
         *  Uses inline data — no custom advanced template    *
         *  needed in NetSuite.                                *
         * -------------------------------------------------- */
        function buildXmlTemplate(data) {
            var rowsHtml = '';
            for (var i = 0; i < data.items.length; i++) {
                var it = data.items[i];
                rowsHtml +=
                    '<tr>' +
                    '<td>' + escapeXml(it.item) + '</td>' +
                    '<td align="right">' + it.quantity + '</td>' +
                    '<td align="right">' + it.rate.toFixed(2) + '</td>' +
                    '<td align="right">' + it.amount.toFixed(2) + '</td>' +
                    '</tr>';
            }

            var xml =
                '<?xml version="1.0"?>' +
                '<!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">' +
                '<pdf>' +
                '<head>' +
                '<style type="text/css">' +
                'table { width: 100%; border-collapse: collapse; font-size: 10pt; }' +
                'th, td { border: 1px solid #999; padding: 4px; }' +
                'th { background-color: #eee; text-align: left; }' +
                '.header { font-size: 18pt; font-weight: bold; margin-bottom: 10px; }' +
                '.meta { margin-bottom: 12px; font-size: 10pt; }' +
                '.totals { margin-top: 10px; width: 40%; float: right; }' +
                '.totals td { border: none; padding: 2px 6px; }' +
                '.totals .label { text-align: right; font-weight: bold; }' +
                '.totals .value { text-align: right; }' +
                '</style>' +
                '</head>' +
                '<body size="A4">' +
                '<div class="header">INVOICE #' + escapeXml(data.invoiceNumber) + '</div>' +
                '<table class="meta" style="border:none;">' +
                '<tr>' +
                '<td style="border:none;"><b>Customer:</b> ' + escapeXml(data.customerName) + '</td>' +
                '<td style="border:none;"><b>Date:</b> ' + escapeXml(data.tranDate) + '</td>' +
                '</tr>' +
                '<tr>' +
                '<td style="border:none;" colspan="2"><b>Location:</b> ' + escapeXml(data.location) + '</td>' +
                '</tr>' +
                '<tr>' +
                '<td style="border:none;" colspan="2"><b>Bill To:</b><br/>' + escapeXml(data.billAddress).replace(/\n/g, '<br/>') + '</td>' +
                '</tr>' +
                '</table>' +
                '<table>' +
                '<thead>' +
                '<tr>' +
                '<th>Item</th>' +
                '<th align="right">Qty</th>' +
                '<th align="right">Rate</th>' +
                '<th align="right">Amount</th>' +
                '</tr>' +
                '</thead>' +
                '<tbody>' + rowsHtml + '</tbody>' +
                '</table>' +
                '<table class="totals">' +
                '<tr><td class="label">Subtotal:</td><td class="value">' + data.subtotal.toFixed(2) + '</td></tr>' +
                '<tr><td class="label">Tax:</td><td class="value">' + data.taxTotal.toFixed(2) + '</td></tr>' +
                '<tr><td class="label">Total:</td><td class="value">' + data.total.toFixed(2) + '</td></tr>' +
                '</table>' +
                '</body>' +
                '</pdf>';

            return xml;
        }

        /* -------------------------------------------------- *
         *  Send base64 PDF to PrintNode                      *
         * -------------------------------------------------- */
        function sendToPrintNode(pdfBase64, jobTitle) {
            // Basic auth: API key as username, empty password
            var authString = encode.convert({
                string: PRINTNODE_API_KEY + ':',
                inputEncoding: encode.Encoding.UTF_8,
                outputEncoding: encode.Encoding.BASE_64
            });

            var body = {
                printerId: PRINTER_ID,
                title: jobTitle,
                contentType: 'pdf_base64',
                content: pdfBase64,
                source: 'NetSuite UE Script',
                options: {
                    copies: 1,
                    paper: 'A4',
                    color: true
                }
            };

            var response = https.post({
                url: 'https://api.printnode.com/printjobs',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + authString
                },
                body: JSON.stringify(body)
            });

            log.audit('PrintNode response', {
                code: response.code,
                body: response.body
            });

            if (response.code < 200 || response.code >= 300) {
                throw new Error('PrintNode API error ' + response.code + ': ' + response.body);
            }
        }

        /* -------- helpers -------- */
        function escapeXml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        }

        return {
            afterSubmit: afterSubmit
        };
    });