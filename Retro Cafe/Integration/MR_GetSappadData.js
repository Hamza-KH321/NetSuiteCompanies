/** 
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/crypto', 'N/encode', 'N/http', 'N/search', 'N/record'], function (crypto, encode, http, search, record) {

    function getInputData() {
        try {
            var locationKey = 'cd2249fc3a0576d71918f189973ca85b';
            var secretKey = '2890d932c3bcc1e7';
            // var timestamp = Math.floor(new Date().getTime() / 1000);
            var timestamp = '1750227533';
            var combinedData = locationKey + timestamp;
            // var nonce = createSecureKeyWithHash(combinedData, secretKey).toLowerCase();
            var nonce = 'dd78d66be5296b33f26c3e20170ba0a079f48485c6907e897148e6625f66516c';

            var startTime = '1716940802';
            var endTime = '1717027202';

            // ✅ Construct the API URL using the nonce and timestamp variables
            var apiUrl = 'http://api.sapaad.com/erp_interface/v4/get_orders/?' +
                'start_time=' + startTime +
                '&end_time=' + endTime +
                '&vendor_key=d08183f9052bb9c471d532450afcb288' +
                '&company_key=0716437a218408883ac9c3f54a0572c4' +
                '&location_key=' + locationKey +
                '&nonce=' + nonce +
                '&time_stamp=' + timestamp +
                '&f=json';

            var response = http.get({
                url: apiUrl,
                headers: { "secret_key": "5c288a071012c5bb" }
            });

            if (response.code == 200) {
                var responseBody = JSON.parse(response.body.toString());
            }

        } catch (e) {
            log.error('error is ', e);
        }
        return responseBody;
    }


    function createSecureKeyWithHash(input, key) {
        var secretKey = crypto.createSecretKey({
            encoding: crypto.Encoding.UTF_8,
            secret: 'custsecret_vs_sapaad'
        });

        var hash = crypto.createHmac({
            algorithm: crypto.HashAlg.SHA256,
            key: secretKey
        });
        hash.update({
            input: input
        });
        return hash.digest({
            outputEncoding: crypto.Encoding.HEX
        });
    }

    function map(context) {
        try {
            var parsedData = JSON.parse(context.value);
            var orderNo = parsedData.order_no;

            // Process only specific orders
            if (orderNo != '349527' && orderNo != '349537') {
                return;
            }

            var location = parsedData.location_name;
            var customerNetsuiteId = 624; // Hardcoded fallback
            var notes = parsedData.notes;
            var orderItems = parsedData.order_items;

            // Create the Sales Order
            var salesOrder = record.create({
                type: record.Type.SALES_ORDER,
                isDynamic: true
            });

            salesOrder.setValue({ fieldId: 'entity', value: customerNetsuiteId });
            salesOrder.setValue({ fieldId: 'location', value: 6 }); // Hardcoded for now
            salesOrder.setValue({ fieldId: 'memo', value: notes });
            salesOrder.setValue({ fieldId: 'custbody_vs_sapaad_order_id', value: orderNo });
            salesOrder.setValue({ fieldId: 'custbody_vs_sapaad', value: true });

            for (var i = 0; i < orderItems.length; i++) {
                var itemID = orderItems[i].item_id;
                var itemQty = orderItems[i].quantity;
                var itemPrice = orderItems[i].price; // ✅ Corrected here

                var itemSearchObj = search.create({
                    type: "item",
                    filters: [["upccode", "is", itemID.toString()]],
                    columns: [
                        search.createColumn({ name: "itemid", sort: search.Sort.ASC }),
                        search.createColumn({ name: "upccode" }),
                        search.createColumn({ name: "internalid" })
                    ]
                });

                var itemSearchResults = itemSearchObj.run().getRange({ start: 0, end: 1 });
                if (itemSearchResults.length < 1) {
                    throw new Error('Item not found: ' + itemID);
                }

                var itemNetSuiteId = itemSearchResults[0].id;

                log.debug('Adding item line', {
                    orderNo: orderNo,
                    itemID: itemID,
                    itemQty: itemQty,
                    itemPrice: itemPrice,
                    itemNetSuiteId: itemNetSuiteId
                });

                salesOrder.selectNewLine({ sublistId: 'item' });
                salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemNetSuiteId });
                salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: itemQty });
                salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: itemPrice });
                salesOrder.commitLine({ sublistId: 'item' });
            }

            var salesOrderId = salesOrder.save();
            log.debug('Created Sales Order ID', salesOrderId);

        } catch (error) {
            log.error('Error in map', error);
        }
    }

    return {
        getInputData: getInputData,
        map: map,
    };
});
