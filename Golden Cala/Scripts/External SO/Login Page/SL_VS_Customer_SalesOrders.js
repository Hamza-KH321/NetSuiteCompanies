/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @Filename SL_VS_Customer_SalesOrders.js
 * @Description Serves the Customer Sales Orders dashboard page and handles AJAX-based data loading.
 */
define(['N/file', 'N/search', 'N/log', 'N/url', 'N/render', './VS_Token_Helper'], function (file, search, log, url, render, tokenHelper) {

    function onRequest(context) {
        try {
            const request = context.request;
            const method = request.method;
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
            log.debug('data', {
                customerId: customerId,
                userId: userId
            })
            if (method === 'GET') {
                const htmlFile = file.load({ id: 'External SO/Customer_SalesOrders.html' });
                context.response.write(htmlFile.getContents());

            } else if (method === 'POST') {
                const requestData = JSON.parse(request.body);

                // ✅ Handle print request early and exit
                if (requestData.action === 'print' && requestData.transactionId) {
                    try {
                        const pdfFile = render.transaction({
                            entityId: parseInt(requestData.transactionId),
                            printMode: render.PrintMode.PDF
                        });

                        context.response.setHeader({
                            name: 'Content-Type',
                            value: 'application/pdf'
                        });

                        context.response.write(pdfFile.getContents());
                        return;
                    } catch (err) {
                        log.error('PDF Generation Error', err);
                        context.response.statusCode = 500;
                        context.response.write('Error generating PDF');
                        return;
                    }
                }
                if (requestData.action === 'logout') {
                    const loginUrl = url.resolveScript({
                        scriptId: 'customscript_vs_sl_login',
                        deploymentId: 'customdeploy1',
                        returnExternalUrl: true
                    });

                    context.response.write(`
                        <html>
                        <head><meta http-equiv="refresh" content="0;url=${loginUrl}"></head>
                        <body></body>
                        </html>
                    `);
                    return;
                }


                // 🔍 Search logic for sales orders
                const userContext = getUserContext(userId);
                log.debug('userContext', userContext);
                const filters = buildFilters(requestData, userContext.customerId, userId);
                const results = runSalesOrderSearch(filters);

                context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
                context.response.write(JSON.stringify({ results: results, context: userContext }));
            }

        } catch (e) {
            log.error('Suitelet Error', e);
            context.response.write('An error occurred');
        }
    }


    function buildFilters(requestData, customerId, userId) {
        const filters = [['type', 'anyof', 'SalesOrd'], 'AND', ['mainline', 'is', 'T']];
        if (userId) filters.push('AND', ['custbody_vs_external_so_user', 'anyof', userId]);
        if (customerId) filters.push('AND', ['name', 'anyof', customerId]);
        if (requestData.docNumber) filters.push('AND', ['tranid', 'contains', requestData.docNumber]);
        if (requestData.poNumber) filters.push('AND', ['otherrefnum', 'equalto', requestData.poNumber]);
        if (requestData.status) filters.push('AND', ['status', 'anyof', requestData.status]);
        if (requestData.dateFrom) filters.push('AND', ['trandate', 'onorafter', formatDateToDDMMYYYY(requestData.dateFrom)]);
        if (requestData.dateTo) filters.push('AND', ['trandate', 'onorbefore', formatDateToDDMMYYYY(requestData.dateTo)]);
        return filters;
    }

    function runSalesOrderSearch(filters) {
        const results = [];

        const searchObj = search.create({
            type: 'salesorder',
            filters: filters,
            columns: [
                search.createColumn({ name: 'tranid', sort: search.Sort.DESC }),
                search.createColumn({ name: 'trandate' }),
                search.createColumn({ name: 'memo' }),
                search.createColumn({ name: 'location' }),
                search.createColumn({ name: 'salesrep' }),
                search.createColumn({ name: 'statusref' }),
                search.createColumn({ name: 'otherrefnum' }),
                search.createColumn({ name: 'formulacurrency', formula: '{amount}-{taxtotal}' }),
                search.createColumn({ name: 'taxtotal' }),
                search.createColumn({ name: 'amount' }),
                search.createColumn({ name: 'entity' })
            ]
        });

        const pagedData = searchObj.runPaged({ pageSize: 1000 });
        pagedData.pageRanges.forEach(function (pageRange) {
            const page = pagedData.fetch({ index: pageRange.index });
            page.data.forEach(function (result) {
                results.push({
                    internalId: result.id,
                    tranid: result.getValue('tranid'),
                    trandate: result.getValue('trandate'),
                    memo: result.getValue('memo') || '',
                    location: result.getText('location') || '',
                    salesrep: result.getText('salesrep') || '',
                    status: result.getText('statusref') || '',
                    poNumber: result.getValue('otherrefnum') || '',
                    beforeTax: result.getValue({ name: 'formulacurrency' }),
                    tax: result.getValue('taxtotal'),
                    total: result.getValue('amount'),
                    customer: result.getText('entity') || ''
                });
            });
        });

        return results;
    }

    function getUserContext(userId) {
        let userName = '';
        let userLocation = '';
        let userBranch = '';
        let createSalesOrderUrl = '';
        let viewSalesOrderUrlBase = '';
        let customerId = '';
        let customerName = '';

        if (userId) {
            try {
                const userLookup = search.lookupFields({
                    type: 'customrecord_vs_customer_users',
                    id: userId,
                    columns: ['custrecord_vs_uc_username', 'custrecord_vs_uc_location', 'custrecord_vs_uc_branch', 'custrecord_vs_uc_customer']
                });

                userName = userLookup.custrecord_vs_uc_username || '';

                if (userLookup.custrecord_vs_uc_location && userLookup.custrecord_vs_uc_location.length > 0) {
                    userLocation = userLookup.custrecord_vs_uc_location[0].text;
                }

                if (userLookup.custrecord_vs_uc_branch && userLookup.custrecord_vs_uc_branch.length > 0) {
                    userBranch = userLookup.custrecord_vs_uc_branch[0].text;
                }
                customerId = userLookup.custrecord_vs_uc_customer ? userLookup.custrecord_vs_uc_customer[0].value : '';
                customerName = userLookup.custrecord_vs_uc_customer ? userLookup.custrecord_vs_uc_customer[0].text : '';
            } catch (e) {
                log.error('User Lookup Failed', e);
            }
        }

        try {
            createSalesOrderUrl = url.resolveScript({
                scriptId: 'customscript_vs_sl_create_sales_order', // Update with actual script ID
                deploymentId: 'customdeploy1', // Update with actual deploy ID
                returnExternalUrl: true,
                params: {
                    token: tokenHelper.createToken({ userId, customerId })

                }
            });

            viewSalesOrderUrlBase = url.resolveScript({
                scriptId: 'customscript_vs_sl_view_so_lines',
                deploymentId: 'customdeploy1',
                returnExternalUrl: true,
                params: {
                    token: tokenHelper.createToken({ userId, customerId })
                }
            });

        } catch (e) {
            log.error('Failed to resolve Create SO URL', e);
        }

        return {
            userName: userName,
            userLocation: userLocation,
            userBranch: userBranch,
            customerId: customerId,
            customerName: customerName,
            createSalesOrderUrl: createSalesOrderUrl,
            viewSalesOrderUrlBase: viewSalesOrderUrlBase

        };
    }
    function formatDateToDDMMYYYY(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;

        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    return { onRequest };
});
