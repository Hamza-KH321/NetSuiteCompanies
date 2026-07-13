/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Consignment Sales Order Data
 */
define(['N/log', 'N/search'], function (log, search) {

    function onRequest(context) {
        try {

            log.debug('onRequest', 'method: ' + context.request.method);

            var tranId = '';

            if (context.request.method == 'GET') {
                tranId = context.request.parameters.tranid || context.request.parameters.so || '';
            }
            else if (context.request.method == 'POST') {
                try {
                    var body = context.request.body || '';
                    if (body) {
                        var parsed = JSON.parse(body);
                        tranId = (parsed && (parsed.tranid || parsed.so)) || '';
                    }
                } catch (e) {
                    tranId = context.request.parameters.tranid || context.request.parameters.so || '';
                }
            }

            tranId = tranId ? String(tranId).trim() : '';

            if (!tranId) {

                context.response.setHeader({
                    name: 'Content-Type',
                    value: 'application/json'
                });

                context.response.write(JSON.stringify({
                    success: false,
                    message: 'Missing tranid'
                }));

                return;
            }

            log.audit('Input tranid', tranId);

            // ------------------------------------------------
            // 1. GET INVENTORY TRANSFER FROM SALES ORDER
            // ------------------------------------------------

            var transferId = '';

            var soSearch = search.create({
                type: "salesorder",
                filters: [
                    ["type", "anyof", "SalesOrd"],
                    "AND",
                    ["transactionnumbertext", "haskeywords", tranId],
                    "AND",
                    ["mainline", "is", "T"]
                ],
                columns: [
                    search.createColumn({ name: "custbody_vs_consignment_inventory_tran" })
                ]
            });

            var soResult = soSearch.run().getRange({ start: 0, end: 1 });

            if (soResult.length > 0) {

                transferId = soResult[0].getValue({
                    name: 'custbody_vs_consignment_inventory_tran'
                });

            }

            log.debug('Inventory Transfer ID', transferId);

            if (!transferId) {

                context.response.write(JSON.stringify({
                    success: false,
                    message: 'Inventory Transfer not found for this SO'
                }));

                return;
            }

            // ------------------------------------------------
            // 2. GET INVENTORY TRANSFER LINES
            // ------------------------------------------------

            var resultsArr = [];

            var invTransferSearch = search.create({
                type: "inventorytransfer",
                filters: [
                    ["internalid", "anyof", transferId],
                    "AND",
                    ["mainline", "is", "F"],
                    "AND",
                    ["taxline", "is", "F"],
                    "AND",
                    ["shipping", "is", "F"],
                    "AND",
                    ["formulatext: case when TO_CHAR({quantity}) not like '%-%' then 'T' else 'F' end", "is", "T"],
                    "AND",
                    ["custbody_vs_consignment_sales_order.mainline", "is", "F"],
                    "AND",
                    ["custbody_vs_consignment_sales_order.taxline", "is", "F"],
                    "AND",
                    ["custbody_vs_consignment_sales_order.shipping", "is", "F"],
                    "AND",
                    ["formulanumeric: CASE WHEN {item} = {custbody_vs_consignment_sales_order.item} THEN 1 ELSE 0 END ", "equalto", "1"],

                ],
                columns: [

                    search.createColumn({ name: "item" }),
                    search.createColumn({ name: "quantity", join: "inventoryDetail" }),
                    search.createColumn({ name: "inventorynumber", join: "inventoryDetail" }),
                    search.createColumn({ name: "expirationdate", join: "inventoryDetail" }),
                    search.createColumn({ name: "upccode", join: "item" }),
                    search.createColumn({ name: "custitem_vc_publicprice", join: "item" }),
                    search.createColumn({ name: "rate", join: "CUSTBODY_VS_CONSIGNMENT_SALES_ORDER", label: "Item Rate" }),
                    search.createColumn({ name: "custcol_vs_baseprice", join: "CUSTBODY_VS_CONSIGNMENT_SALES_ORDER", label: "Base Price" }),
                    search.createColumn({name: "taxamount",join: "CUSTBODY_VS_CONSIGNMENT_SALES_ORDER",label: "Amount (Tax)"})

                ]
            });

            var pagedData = invTransferSearch.runPaged({ pageSize: 1000 });

            pagedData.pageRanges.forEach(function (pageRange) {

                var page = pagedData.fetch({ index: pageRange.index });

                page.data.forEach(function (result) {

                    var rateValue = result.getValue({ name: 'rate', join: 'CUSTBODY_VS_CONSIGNMENT_SALES_ORDER' });
                    var basePriceValue = result.getValue({ name: 'custcol_vs_baseprice', join: 'CUSTBODY_VS_CONSIGNMENT_SALES_ORDER' });

                    log.debug('Rate Value', rateValue);

                    resultsArr.push({

                        item: {
                            value: result.getValue({ name: 'item' }),
                            text: result.getText({ name: 'item' })
                        },

                        quantity: result.getValue({ name: 'quantity', join: 'inventoryDetail' }),
                        upccode: result.getValue({ name: 'upccode', join: 'item' }),
                        publicPrice: result.getValue({ name: 'custitem_vc_publicprice', join: 'item' }),
                        taxAmount: result.getValue({ name: 'taxamount', join: 'CUSTBODY_VS_CONSIGNMENT_SALES_ORDER' }),
                        rate: rateValue,
                        basePrice: basePriceValue,

                        inventorynumber: {
                            value: result.getValue({
                                name: 'inventorynumber',
                                join: 'inventoryDetail'
                            }),
                            text: result.getText({
                                name: 'inventorynumber',
                                join: 'inventoryDetail'
                            })
                        },

                        expirationdate: result.getValue({
                            name: 'expirationdate',
                            join: 'inventoryDetail'
                        })

                    });

                    return true;

                });

                return true;

            });

            // ------------------------------------------------
            // RESPONSE
            // ------------------------------------------------

            context.response.setHeader({
                name: 'Content-Type',
                value: 'application/json'
            });

            context.response.write(JSON.stringify({
                success: true,
                tranid: tranId,
                inventoryTransfer: transferId,
                count: resultsArr.length,
                results: resultsArr
            }));

        } catch (err) {

            log.error('Error in onRequest', err);

            context.response.write(JSON.stringify({
                success: false,
                error: err.message
            }));

        }

    }

    return {
        onRequest: onRequest
    };

});