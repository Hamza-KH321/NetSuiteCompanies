/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @Filename SL_VS_Create_SalesOrder.js
 * @Description Serves the Create Sales Order page and handles dynamic data + creation logic.
 */
define([
    'N/ui/serverWidget', 'N/search', 'N/record', 'N/file', 'N/log', 'N/url', './VS_Token_Helper','N/email'
], function (serverWidget, search, record, file, log, url, tokenHelper, email) {


    function onRequest(context) {
        try {
            const method = context.request.method;
            // ✅ Step 1: Validate token
            const tokenData = tokenHelper.verifyToken(context.request.parameters.token || '');
            if (!tokenData || !tokenData.customerId || !tokenData.userId) {
                const loginUrl = url.resolveScript({
                    scriptId: 'customscript_vs_sl_login',
                    deploymentId: 'customdeploy1',
                    returnExternalUrl: true
                });

                context.response.write(`<html><head><meta http-equiv="refresh" content="0;url=${loginUrl}"></head><body></body></html>`);
                return;
            }
            if (method === 'GET') {
                const htmlFile = file.load({ id: 'External SO/Create_SalesOrder.html' });
                context.response.write(htmlFile.getContents());

            } else if (method === 'POST') {
                const body = JSON.parse(context.request.body);

                const userId = tokenData.userId;
                const customerId = tokenData.customerId;
                const userInfo = getUserContext(userId);
                const itemPricing = getCustomerItemPricing(userInfo.customerId);
                const segmentFilters = getSegmentFilters(userInfo.customerId);
                const allItems = getAllItems(userInfo.userLocationId, segmentFilters);
                const filteredItems = allItems.filter(item => {
                    const price = itemPricing[item.id];
                    return price != null && parseFloat(price) > 0;
                });


                if (body.action === 'getFormContext') {

                    const response = {
                        userInfo: userInfo,
                        itemPricing: itemPricing,
                        segmentFilters: segmentFilters,
                        itemOptions: filteredItems,
                        backUrl: url.resolveScript({
                            scriptId: 'customscript_vs_sl_customer_sales_ord',
                            deploymentId: 'customdeploy1',
                            params: { token: tokenHelper.createToken({ userId, customerId }) },
                            returnExternalUrl: true
                        })
                    };

                    context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
                    context.response.write(JSON.stringify(response));
                    return;
                }
                log.debug('body  ', body);
                if (body.action === 'createSalesOrder') {
                    const customerId = body.customerId;
                    const userCustomerName = body.userCustomerName;
                    const userCustomerPhoneNumber = body.userCustomerPhoneNumber;
                    const soDate = formatDateToDDMMYYYY(body.soDate);
                    const memo = body.memo;
                    const poNumber = body.poNumber;
                    const locationId = body.locationId;
                    const branchId = body.branchId;
                    const lines = body.lines;

                    log.debug('Sales Order Data', {
                        customerId: customerId,
                        userCustomerName: userCustomerName,
                        userCustomerPhoneNumber: userCustomerPhoneNumber,
                        soDate: soDate,
                        memo: memo,
                        poNumber: poNumber,
                        locationId: locationId,
                        branchId: branchId,
                        lines: lines
                    }
                    )

                    if (!customerId || !lines || lines.length === 0) {
                        context.response.write('Missing required data for Sales Order.');
                        return;
                    }

                    let salesRepId = null;
                    try {
                        const customerLookup = search.lookupFields({
                            type: record.Type.CUSTOMER,
                            id: customerId,
                            columns: ['salesrep']
                        });
                        if (customerLookup.salesrep && customerLookup.salesrep.length > 0) {
                            salesRepId = customerLookup.salesrep[0].value;
                        }
                    } catch (e) {
                        log.error('Customer Lookup Error', e);
                    }

                    const salesOrder = record.create({ type: record.Type.SALES_ORDER, isDynamic: true });
                    salesOrder.setValue({ fieldId: 'customform', value: 152 });
                    salesOrder.setValue({ fieldId: 'entity', value: customerId });
                    salesOrder.setValue({ fieldId: 'custbody_vs_external_so_user', value: userId });
                    salesOrder.setValue({ fieldId: 'custbody_vs_external_so_customer_name', value: userCustomerName });
                    salesOrder.setValue({ fieldId: 'custbody_vs_external_so_customer_phone', value: userCustomerPhoneNumber });


                    if (soDate) salesOrder.setText({ fieldId: 'trandate', text: soDate });
                    if (memo) salesOrder.setValue({ fieldId: 'memo', value: memo });
                    if (poNumber) salesOrder.setValue({ fieldId: 'otherrefnum', value: poNumber });
                    if (salesRepId) salesOrder.setValue({ fieldId: 'salesrep', value: salesRepId });
                    if (locationId) salesOrder.setValue({ fieldId: 'location', value: locationId });
                    // if (branchId) salesOrder.setValue({ fieldId: 'custbody_vs_sales_order_branch', value: branchId });
                    salesOrder.setValue({ fieldId: 'custbody_vs_external_so', value: true });

                    lines.forEach(line => {
                        salesOrder.selectNewLine({ sublistId: 'item' });
                        salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: line.item });
                        salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: line.quantity });
                        // salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: line.rate });
                        salesOrder.commitLine({ sublistId: 'item' });
                    });

                    const salesOrderId = salesOrder.save();

                    // Get Sales Order number (tranid)
                    const salesOrderData = search.lookupFields({
                        type: record.Type.SALES_ORDER,
                        id: salesOrderId,
                        columns: ['tranid', 'salesrep']
                    });

                    const salesOrderNumber = salesOrderData.tranid;
                    const salesRepId1 = salesOrderData.salesrep.length ? salesOrderData.salesrep[0].value : null;

                    // Build NetSuite URL to the Sales Order
                    const baseUrl ='https://6371802.app.netsuite.com';
                    const soUrl = `${baseUrl}/app/accounting/transactions/salesord.nl?id=${salesOrderId}`;

                    // Send Email
                    if (salesRepId1) {
                        email.send({
                            author: -5,
                            recipients: salesRepId,
                            // recipients: 'h.khasawneh@ver-solutions.com',
                            subject: `Sales Order ${salesOrderNumber} Created`,
                            body: `
                                    Hello,
                                                
                                    A new Sales Order (${salesOrderNumber}) has been created.
                                                
                                    <p>You can view it here: <a href="${soUrl}" target="_blank">${soUrl}</a></p>
                                    <p>Regards,<br>NetSuite System</p>
                                `
                        });
                    }

                    context.response.write('Sales Order created successfully. Document Number: ' + salesOrderNumber);

                    return;
                }

                if (body.action === 'logout') {
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


                context.response.write('Unknown action.');
            }
        } catch (e) {
            log.error('Suitelet Error', e);
            context.response.write('An unexpected error occurred.');
        }
    }

    function getUserContext(userId) {
        const userInfo = {
            userName: '',
            userLocationText: '',
            userLocationId: '',
            userBranchText: '',
            userBranchId: '',
            customerId: '',
            customerName: '',
            backUrl: '',
            userCustomerName: '',
            userCustomerPhoneNumber: '',
        };

        try {
            const userLookup = search.lookupFields({
                type: 'customrecord_vs_customer_users',
                id: userId,
                columns: [
                    'custrecord_vs_uc_username',
                    'custrecord_vs_uc_location',
                    'custrecord_vs_uc_branch',
                    'custrecord_vs_uc_customer',
                    'custrecord_vs_uc_customer_name',
                    'custrecord_vs_uc_customer_phone',
                ]
            });

            userInfo.userName = userLookup.custrecord_vs_uc_username || '';

            if (userLookup.custrecord_vs_uc_location?.length > 0) {
                userInfo.userLocationText = userLookup.custrecord_vs_uc_location[0].text;
                userInfo.userLocationId = userLookup.custrecord_vs_uc_location[0].value;
            }

            if (userLookup.custrecord_vs_uc_branch?.length > 0) {
                userInfo.userBranchText = userLookup.custrecord_vs_uc_branch[0].text;
                userInfo.userBranchId = userLookup.custrecord_vs_uc_branch[0].value;
            }

            if (userLookup.custrecord_vs_uc_customer?.length > 0) {
                userInfo.customerId = userLookup.custrecord_vs_uc_customer[0].value;
                userInfo.customerName = userLookup.custrecord_vs_uc_customer[0].text;
            }

            userInfo.userCustomerName = userLookup.custrecord_vs_uc_customer_name || '';
            userInfo.userCustomerPhoneNumber = userLookup.custrecord_vs_uc_customer_phone || '';

            const token = tokenHelper.createToken({ userId: userId, customerId: userInfo.customerId });

            userInfo.backUrl = url.resolveScript({
                scriptId: 'customscript_vs_sl_customer_sales_ord',
                deploymentId: 'customdeploy1',
                params: { token },
                returnExternalUrl: true
            });

        } catch (e) {
            log.error('getUserContext Error', e);
        }

        return userInfo;
    }



    function getSegmentFilters(customerId) {
        const filters = [];

        if (!customerId) return filters;

        try {
            const segmentSearch = search.create({
                type: 'customrecord_vs_customer_segment_filters',
                filters: [['custrecord_vs_csf_customer', 'anyof', customerId]],
                columns: [
                    'custrecord_vs_csf_brand',
                    'custrecord_vs_csf_color',
                    'custrecord_vs_csf_type'
                ]
            });

            segmentSearch.run().each(result => {
                filters.push({
                    brand: result.getText('custrecord_vs_csf_brand') || '',
                    brandId: result.getValue('custrecord_vs_csf_brand') || '',
                    color: result.getText('custrecord_vs_csf_color') || '',
                    colorId: result.getValue('custrecord_vs_csf_color') || '',
                    type: result.getText('custrecord_vs_csf_type') || '',
                    typeId: result.getValue('custrecord_vs_csf_type') || ''
                });
                return true;
            });
        } catch (e) {
            log.error('getSegmentFilters Error', e);
        }

        return filters;
    }


    function getAllItems(userLocationId, segmentFilters) {
        const items = [];

        const filterExpressions = [
            ["type", "anyof", "InvtPart"],
            "AND",
            ["isinactive", "is", "F"],
            'AND',
            ['inventorylocation', 'anyof', userLocationId],
            "OR",
            [["class", "noneof", "6"], "AND", ["custitem26", "noneof", "64"]]

        ];

        const brandIds = new Set();
        const colorIds = new Set();
        const typeIds = new Set();

        if (segmentFilters && segmentFilters.length > 0) {
            segmentFilters.forEach(seg => {
                if (seg.brandId) brandIds.add(seg.brandId);
                if (seg.colorId) colorIds.add(seg.colorId);
                if (seg.typeId) typeIds.add(seg.typeId);
            });
            log.debug('brandIds', brandIds);
            log.debug('colorIds', colorIds);
            log.debug('typeIds', typeIds);

            if (brandIds.size > 0) {
                filterExpressions.push('AND', ['class', 'anyof', ...Array.from(brandIds)]);
            }
            if (colorIds.size > 0) {
                filterExpressions.push('AND', ['custitem27', 'anyof', ...Array.from(colorIds)]);
            }
            if (typeIds.size > 0) {
                filterExpressions.push('AND', ['custitem28', 'anyof', ...Array.from(typeIds)]);
            }
        }

        const itemSearch = search.create({
            type: "item",
            filters: filterExpressions,
            columns: [
                'displayname', 'salesdescription', 'baseprice', 'class', 'taxschedule', 'saleunit', 'name',
                'custitem24', 'custitem25', 'custitem26', 'custitem27', 'custitem28', 'custitem39', 'custitem41',
                'locationquantityavailable'
            ]
        });

        const paged = itemSearch.runPaged({ pageSize: 1000 });

        paged.pageRanges.forEach(range => {
            const page = paged.fetch({ index: range.index });
            page.data.forEach(result => {
                const displayName = result.getValue('displayname') || result.getValue('name');
                items.push({
                    id: result.id,
                    text: displayName,
                    description: result.getValue('salesdescription') || '',
                    rate: result.getValue('baseprice') || 0,
                    brand: result.getText('class') || '',
                    classId: result.getValue('class') || '',
                    taxschedule: result.getText('taxschedule') || '',
                    unit: result.getText('saleunit') || '',
                    custitem24: result.getValue('custitem24') || '',
                    custitem25: result.getValue('custitem25') || '',
                    custitem26: result.getValue('custitem26') || '',
                    custitem27: result.getValue('custitem27') || '',
                    custitem28: result.getValue('custitem28') || '',
                    custitem39: result.getValue('custitem39') || '',
                    custitem41: result.getValue('custitem41') || '',
                    locationquantityavailable: result.getValue('locationquantityavailable') || 0
                });
            });
        });

        return items;
    }


    function getCustomerItemPricing(customerId) {
        const pricing = {};
        if (!customerId) return pricing;

        try {
            const customerRec = record.load({
                type: record.Type.CUSTOMER,
                id: customerId,
                isDynamic: false
            });

            const lineCount = customerRec.getLineCount({ sublistId: 'itempricing' });
            for (let i = 0; i < lineCount; i++) {
                const itemId = customerRec.getSublistValue({ sublistId: 'itempricing', fieldId: 'item', line: i });
                const price = customerRec.getSublistValue({ sublistId: 'itempricing', fieldId: 'price', line: i });
                if (itemId && price != null) {
                    pricing[itemId] = price;
                }
            }
        } catch (e) {
            log.error('Item Pricing Error', e);
        }

        return pricing;
    }

    function formatDateToDDMMYYYY(dateStr) {
        if (!dateStr) return null;

        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;

        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    return { onRequest };
});
