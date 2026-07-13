/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @Filename SL_VS_View_SO_Lines.js
 * @Description Suitelet to view Sales Order lines in a table format (POST-based, no .replace()).
 */
define(['N/search', 'N/file', 'N/log', 'N/url', './VS_Token_Helper'], function (search, file, log, url, tokenHelper) {

    function onRequest(context) {
        try {
            const request = context.request;

            const tokenData = tokenHelper.verifyToken(request.parameters.token || '');
            // ✅ Check for invalid or expired token
            if (!tokenData || !tokenData.customerId || !tokenData.userId) {
                const loginUrl = url.resolveScript({
                    scriptId: 'customscript_vs_sl_login',
                    deploymentId: 'customdeploy1',
                    returnExternalUrl: true
                });

                context.response.write(`<html><head><meta http-equiv="refresh" content="0;url=${loginUrl}"></head><body></body></html>`);
                return;
            }

            const customerId = tokenData.customerId;
            const userId = tokenData.userId;

            // GET: Serve HTML only
            if (request.method === 'GET') {
                const htmlFile = file.load({ id: 'External SO/View_SO_Lines.html' });
                context.response.write(htmlFile.getContents());
                return;
            }

            // POST: Parse action
            const body = JSON.parse(request.body);
            const action = body.action;

            if (action === 'getSalesOrderLines') {
                const soId = body.soid;
                if (!soId) {
                    context.response.write(JSON.stringify({ error: 'Missing Sales Order ID.' }));
                    return;
                }

                const rows = [];

                const salesorderSearchObj = search.create({
                    type: "salesorder",
                    settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
                    filters: [
                        ["type", "anyof", "SalesOrd"],
                        "AND",
                        ["mainline", "is", "F"],
                        "AND",
                        ["internalid", "anyof", soId],
                        "AND",
                        ["taxline", "is", "F"]
                    ],
                    columns: [
                        search.createColumn({ name: "item", label: "Item" }),
                        search.createColumn({name: "unit", label: "Units"}),
                        search.createColumn({ name: "rate", label: "Item Rate" }),
                        search.createColumn({ name: "quantity", label: "Quantity" }),
                        search.createColumn({ name: "amount", label: "Amount" })
                    ]
                });

                salesorderSearchObj.run().each(result => {
                    rows.push({
                        item: result.getText('item') || '',
                        unit: result.getValue('unit') || '',
                        rate: result.getValue('rate') || '',
                        quantity: result.getValue('quantity') || '',
                        amount: result.getValue('amount') || ''
                    });
                    return true;
                });

                context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
                context.response.write(JSON.stringify({ rows }));
                return;
            }

            if (action === 'getBackUrl') {
                const backUrl = url.resolveScript({
                    scriptId: 'customscript_vs_sl_customer_sales_ord', // 🔁 update as needed
                    deploymentId: 'customdeploy1',
                    returnExternalUrl: true,
                    params: {
                        token: tokenHelper.createToken({ userId, customerId })

                    }
                });

                context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
                context.response.write(JSON.stringify({ backUrl }));
                return;
            }

            context.response.write(JSON.stringify({ error: 'Unknown action.' }));

        } catch (e) {
            log.error('Error in View SO Lines Suitelet', e);
            context.response.write('Error processing request.');
        }
    }

    return { onRequest };
});
