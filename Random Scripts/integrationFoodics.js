/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/https', 'N/record', 'N/search', 'N/log'],

    function (https, record, search, log) {

        /**
         * Marks the beginning of the Map/Reduce process and generates input data.
         *
         * @typedef {Object} ObjectRef
         * @property {number} id - Internal ID of the record instance
         * @property {string} type - Record type id
         *
         * @return {Array|Object|Search|RecordRef} inputSummary
         * @since 2015.1
         */

        function getInputData() {
            var salesorderSearchObj = search.create({
                type: "salesorder",
                filters:
                    [
                        ["type", "anyof", "SalesOrd"],
                        "AND",
                        ["mainline", "is", "T"],
                        "AND",
                        ["custbody_vs_order_number", "isnotempty", ""]
                    ],
                columns:
                    [
                        search.createColumn({ name: "internalid" }),
                        search.createColumn({ name: "custbody_vs_order_number", sort: search.Sort.DESC, label: "Order Number " })
                    ]
            });
            var soResults = salesorderSearchObj.run().getRange({ start: 0, end: 1 });
            var ref_After = soResults[0].getValue({ name: 'custbody_vs_order_number' });
            log.debug('order after  ', ref_After);


            var allData = []; // Store all retrieved data here
            var Page = 0;
            var TotalPages = 0;
            var currentDate = new Date();
            var formattedDate = currentDate.getFullYear() + '-' + ('0' + (currentDate.getMonth() + 1)).slice(-2) + '-' + ('0' + currentDate.getDate()).slice(-2);

            var PageUrl = 'https://api.foodics.com/v5/orders?include=payments.payment_method,customer,products.product,branch&sort=reference&page=1&filter[created_on]=' + formattedDate;
           // var PageUrl = 'https://api.foodics.com/v5/orders?include=payments.payment_method,customer,products.product,branch &sort=reference&filter[reference]=1442792';
           // var PageUrl = 'https://api.foodics.com/v5/orders?include=payments.payment_method,customer,products.product,branch&sort=reference&page=1&filter[created_on]=' + formattedDate + '&filter[reference_after]= ' + ref_After;

            log.debug('formattedDate', formattedDate);
            try {
                while (PageUrl) {
                    var response = https.get({
                        url: PageUrl,
                        "headers": {
                            "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImEyZDY1OTM5ZDJhODcxY2NkZWQ5ZmJhYzA0OTIxOGUyNjI3OWM3YjU5ZTJiMjA4NmY1Mjg5ODhhZTA5NTc2OTM5ZGI2NmNmOWMxODU0YmZjIn0.eyJhdWQiOiI5MGQ1YTcxOC1lMzBkLTQ5ODYtODY0Ni0wNjdlZDBkMzdkMGUiLCJqdGkiOiJhMmQ2NTkzOWQyYTg3MWNjZGVkOWZiYWMwNDkyMThlMjYyNzljN2I1OWUyYjIwODZmNTI4OTg4YWUwOTU3NjkzOWRiNjZjZjljMTg1NGJmYyIsImlhdCI6MTY4ODQ1NzA3MywibmJmIjoxNjg4NDU3MDczLCJleHAiOjE4NDYzMDk4NzMsInN1YiI6Il9kNzIyYTE2NyIsInNjb3BlcyI6WyJnZW5lcmFsLnJlYWQiLCJvcmRlcnMubGlzdCIsIm1lbnUuaW5ncmVkaWVudHMucmVhZCJdLCJidXNpbmVzcyI6IjkwMzBkNzY2LWQzNGEtNDgyMi05NTdmLTRlMmUyZTQxYjZmMiIsInJlZmVyZW5jZSI6IjE0Nzc2NSJ9.MJR2VbxqyK5TtAE6MLM2_IJMiA4f4Tyn1uBhMMsln8NT5vK7y32fhi5JMzLwVJgQQD2h6wbckmWAVSt8O8yhYE06_cZV03H_MC5y06kSWiK4Vlx_r_yosDAJDI2iaGmlLAj8DfVZQvxoaiw1zd9A5lrJJV-zvnVD3V4djsplTO7Vo0woKn6ih0KsEipbOZD42a-T_MfWxMh-I8lddSNHYgs4aEqDX8ppdFE_XL0RyEHlKNm28OwtO1IKawd4PW3Ow4U_M-d9GL5GSyS_pHgiYmbNh-RRVYFJsL1IDEoYLwouG11ei8pHlaowW7w3pVmM-UZQBAoAa_zXV3iaw_Fa3_pgHwhkhRjh0aOyiQ1rDMNlnNGMglq7EDHj5XX2F3WXeieEaHEJdDUXuk33uSfRAVV0CFt1aX3pKtLw7HzT5y-m6Nfa4C0pKdwBTD6DtQNM8hjeo08eKAfL_yelJleFJ8cDGy_gcO-y1D3C4IMBR_EFeBzblu1dmrwEAd-PFZqZOmtZ-DVoFaDur8eK-qVOqj3N80a4njjL4X2Ih_6BWVJ5glzeejpPykxhNyer59O37zX0AkDUKNrAVZ-Dc3rrZyNJLbY8buoxAYviq-UQPggmzT-69ZT73HAXg9Rwnw_fggWfCsSwoF_9PWNMNIw8DYrO2FRTxHJKWqQINrlcvHM"
                        }
                    });

                    if (response.code == 200) {
                        var parseBody = JSON.parse(response.body.toString());
                        var currentPageData = parseBody.data;
                        Page = parseBody.meta.current_page;
                        TotalPages = parseBody.meta.last_page;
                        allData = allData.concat(currentPageData); // Add current page data to the overall data

                        log.debug('current_page', Page);

                        // Check if there are more pages to retrieve
                        if (Page < TotalPages) {
                            PageUrl = 'https://api.foodics.com/v5/orders?include=payments.payment_method,customer,products.product,branch &sort=reference&page=' + (Page + 1) + ' &filter[created_on]=' + formattedDate + ' &filter[reference_after]=' + ref_After;
                        } else {
                            PageUrl = null; // No more pages to retrieve
                        }
                       
                    } else if (response.code == 429) {
                        log.error('API Request Failed.Retry Status Code: ', response.code);
                        log.audit('Waiting 2 minutes for the api ');
                        sleep(100000); //freez for 1 minute and 40 seconds
                        if (Page < TotalPages) {
                            PageUrl = 'https://api.foodics.com/v5/orders?include=payments.payment_method,customer,products.product,branch &sort=reference&page=' + (Page + 1) + ' &filter[created_on]=' + formattedDate + ' &filter[reference_after]=' + ref_After;

                        } else {
                            PageUrl = null; // No more pages to retrieve
                        }
                    } else {

                        log.error('API Request Failed. Status Code: ', response.code);
                        log.error('Response Body: ', response.body.toString());
                        PageUrl = null; // Exit the loop
                    }
                }
                log.debug('total pages', TotalPages)
                return allData;

            } catch (e) {
                log.error('An error occurred in getInputData:', e.toString());
                return null;
            }

        }
        /**
         * Executes when the map entry point is triggered and applies to each key/value pair.
         *
         * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
         * @since 2015.1.0
         */
        var allOrderNumber = [];
        function map(context) {
            var parseData = JSON.parse(context.value);
            var products = parseData.products;
            var product;
            var productName;
            var customerId;
            var customerName;
            var branch;
            var branchName;
            var itemUnitPrice;
            var quantity;
            var orderNumber;
            var paymentMethod;
            var paymentMethodId;
            var orderStatus;
            var orderType;

            orderNumber = parseData.reference;
            orderStatus = parseData.status;
            orderType = parseData.type;
            if (orderType != 1){
                orderType = 2;
            }
     
                log.emergency('order number is ', orderNumber);
                log.emergency('order Type is ', orderType);


            if (parseData.hasOwnProperty('payments')) {
                paymentMethod = parseData.payments[0].payment_method.name;
                paymentMethodId = parseData.payments[0].payment_method.id;
                log.debug('paymentMethodId is ', paymentMethodId);
            }
            if (parseData.hasOwnProperty('branch')) {
                branch = parseData.branch.id;
                branchName=parseData.branch.name;
                log.debug('branch is ', branch);
            }
            if (parseData.hasOwnProperty('customer') && parseData.customer != null) {
                customerId = parseData.customer.id;
                customerName=parseData.customer.name;
                paymentMethod = 'Credit';
            }
            else {
                customerId = paymentMethodId;
                customerName=paymentMethod;
            }
            try {
                var locationSearchObj = search.create({
                    type: "location",
                    filters:
                        [
                            ["custrecord_5826_loc_branch_id", "is", branch]
                        ],
                    columns:
                        []
                });

                var branchResults = locationSearchObj.run().getRange({ start: 0, end: 1 });

                if (branchResults.length < 1) {
                    throw new Error('Branch was not found' + branchName);
                }

                var branchId = branchResults[0].id;
                var customerSearchObj = search.create({
                    type: "customer",
                    filters:
                        [
                            ["custentity_vs_custfoodics_id", "is", customerId]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "Internal ID" })
                        ]
                });


                var custResults = customerSearchObj.run().getRange({ start: 0, end: 1 });

                if (custResults.length < 1) {
                    throw new Error('Customer was not found '+customerName);
                }
                var custId = custResults[0].id;

                allOrderNumber.push(orderNumber);

                for (var line = 0; line < products.length; line++) {
                    product = parseData.products[line].product.sku;
                    productName = parseData.products[line].product.name;

                    var itemSearchObj = search.create({
                        type: "item",
                        filters:
                            [
                                ["custitem_vs_sku_code", "is", product],
                                "AND",
                                ["custitem_vs_ordertype", "anyof", orderType, '@NONE@']
                            ],

                        columns:
                            []
                    });

                    var itemResult = itemSearchObj.run().getRange({ start: 0, end: 1 });

                    if (itemResult.length < 1) {
                        throw new Error('Item was not found item is ' + productName);
                    }
                    var itemID = itemResult[0].id;
                    itemUnitPrice = parseData.products[line].tax_exclusive_unit_price;
                    quantity = parseData.products[line].quantity;
                    var itemDetails = {
                        custId: custId,
                        itemId: itemID,
                        quantity: quantity,
                        rate: itemUnitPrice,
                        paymentMethod: paymentMethod,
                        reference_after: [orderNumber]
                    };
                    context.write(branchId, itemDetails);
                }

            } catch (error) {
                log.error('error in creating sales order refernce is ', + orderNumber + ' ' + error)
            }

        }

        function reduce(context) {
            var branchItemsByCustomer = {};
            var customPaymentMode;
            var customPaymentMethod;
            log.audit('enterd the reduce ');

            for (var i = 0; i < context.values.length; i++) {
                var parsedItemDetail = JSON.parse(context.values[i]);
                var custId = parsedItemDetail.custId;

                if (!branchItemsByCustomer[custId]) {
                    branchItemsByCustomer[custId] = [];
                }

                var found = false;

                for (var j = 0; j < branchItemsByCustomer[custId].length; j++) {
                    if (branchItemsByCustomer[custId][j].itemId == parsedItemDetail.itemId && branchItemsByCustomer[custId][j].rate == parsedItemDetail.rate) {
                        branchItemsByCustomer[custId][j].quantity += parsedItemDetail.quantity;
                        branchItemsByCustomer[custId][j].reference_after.push(parsedItemDetail.reference_after);
                        if (!branchItemsByCustomer[custId][j].hasOwnProperty('largest_reference') || parsedItemDetail.reference_after[0] > branchItemsByCustomer[custId][j].largest_reference) {
                            branchItemsByCustomer[custId][j].largest_reference = parsedItemDetail.reference_after[0];
                        }
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    branchItemsByCustomer[custId].push({
                        'itemId': parsedItemDetail.itemId,
                        'quantity': parsedItemDetail.quantity,
                        'rate': parsedItemDetail.rate,
                        'paymentMethod': parsedItemDetail.paymentMethod,
                        'reference_after': [parsedItemDetail.reference_after],
                        'largest_reference': parsedItemDetail.reference_after[0]

                    });
                }
            }
            log.debug({
                title: 'branch customer and items for branch : ' + context.key,
                details: JSON.stringify(branchItemsByCustomer)
            });

            try {
                for (var customer in branchItemsByCustomer) {

                    var so = record.create({ type: record.Type.SALES_ORDER, isDynamic: true });

                    so.setValue({ fieldId: 'entity', value: customer });

                    so.setValue({ fieldId: 'location', value: context.key });

                    var items = branchItemsByCustomer[customer];
                    var largestReferenceForCustomer = 0;
                    if (items[0].paymentMethod == 'Credit') {
                        customPaymentMode = 'Credit';
                        customPaymentMethod = 'Credit';
                    }
                    else {
                        customPaymentMode = 'Paid';
                        customPaymentMethod = 'Cash';
                    }
                    so.setText({ fieldId: 'custbody_ium_payment_mode', text: customPaymentMode });
                    so.setText({ fieldId: 'custbody_ium_payment_method', text: customPaymentMethod });

                    for (var i = 0; i < items.length; i++) {
                        if (items[i].largest_reference > largestReferenceForCustomer) {
                            largestReferenceForCustomer = items[i].largest_reference;
                        }
                        so.selectNewLine({ sublistId: 'item' });
                        so.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            value: items[i].itemId
                        });
                        so.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: items[i].quantity
                        });
                        so.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            value: items[i].rate
                        });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_ium_pstatus', value: 4 });
                        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_ium_rec_pos_status_li', value: 4 });
                        so.commitLine({ sublistId: 'item' });
                    }
                    so.setValue({
                        fieldId: 'custbody_vs_order_number',
                        value: largestReferenceForCustomer
                    });
                    //  var soId = so.save();
                    //  log.audit("Sales Order Created Successfully", "ID: " + soId);
                    log.debug('Largest Reference for Customer ' + customer, largestReferenceForCustomer);

                }
            } catch (e) {
                log.error('Error creating sales order for customer ' + customer, e.toString());
            }

        }
        function sleep(milliseconds) {
            const endTime = Date.now() + milliseconds;
            while (Date.now() < endTime) { }
        }


        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
        };

    });
