/** 
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/crypto','N/encode', 'N/http'], function (crypto,encode,http) {

    function getInputData() {
        try {

            var locationKey = 'ff4b850c6681e874a8a26a556ddd5dc2';
            var secretKey = '5c288a071012c5bb';
            var timestamp = Math.floor(new Date().getTime() / 1000);
            var combinedData = locationKey +  timestamp;
            var nonce = createSecureKeyWithHash(combinedData,secretKey);

            // This code will get the start and end time at 7:00 AM and 12:00 PM once finish we will use it

            /*var startDate = new Date();
            var endDate = new Date();
            startDate.setHours(7, 0, 0, 0);
            endDate.setHours(12, 0, 0, 0);
            var unixStartDate = Math.floor(startDate.getTime() / 1000);
            var unixEndDate = Math.floor(endDate.getTime() / 1000);
            */

            nonce = nonce.toLowerCase();

            log.debug('timestamp is ' , timestamp);
            log.debug('nonce is ' , nonce);

            var apiUrl = 'http://api-stage.sapaad.com/erp_sandbox/v4/get_orders?start_time=1693544400&end_time=1693558800&vendor_key=b7d084ec8004ef56aaf5ab41e17a31d3&company_key=8f2063274f12e821add790a5449e78e4&location_key=ff4b850c6681e874a8a26a556ddd5dc2&nonce='+nonce+'&time_stamp='+timestamp+'&f=json';
            var response = http.get({
                url: apiUrl,
                "Headers": {"secret_key": "5c288a071012c5bb"}
            });

            if (response.code == 200) {
                var responseBody = JSON.parse(response.body.toString());
                log.debug('API responseBody' , responseBody);                
            }
            

        } catch (e) {
            log.error('error is ', e);
        }
        return responseBody;
    }
    function createSecureKeyWithHash(input, key) {

        var secretKey = crypto.createSecretKey({
            encoding: crypto.Encoding.UTF_8,
            secret: 'custsecret_vs_retrosecretkey'
        });

        // log.debug({title: "Secret Key Details",details: JSON.stringify(secretKey)});

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
            // log.debug('Data is' , parsedData);
            var orderNo = parsedData.order_no;
            var location = parsedData.location_name;
            var customerID = parsedData.customer_id;
            var customerName = parsedData.customer_name;
            var totalAmount = parsedData.total_amount;
            var notes = parsedData.notes;
            var totalTax = parsedData.total_tax;
            var orderPayment = parsedData.orders_payments[0].payment_type;
            var totalPaid = parsedData.orders_payments[0].amount;
            var orderItems = parsedData.order_items;
    
    
            // log.debug('orderNo is' , orderNo);
            // log.debug('location is',location);
            // log.debug('customerID is',customerID);
            // log.debug('location is',location);
            // log.debug('customerName is',customerName);
            // log.debug('totalAmount is',totalAmount);
            // log.debug('notes is',notes);
            // log.debug('totalTax is',totalTax);
            // log.debug('orderPayment is',orderPayment);
            // log.debug('totalPaid is',totalPaid);
            // log.debug('orderItems is',orderItems);
            // log.debug('length is',orderItems.length);
            
            for (var i = 0; i < orderItems.length; i++) {
                var itemID = parsedData.order_items[i].item_id;
                var itemName = parsedData.order_items[i].item_name;
                var itemQty = parsedData.order_items[i].quantity;
                var itemPrice = parsedData.order_items[i].quantity;
                var itemTax = parsedData.order_items[i].tax;
                var itemAmount = parsedData.order_items[i].amount;
    
                /*log.debug('Item ID is' , itemID);
                log.debug('itemName is' , itemName);
                log.debug('itemQty is' , itemQty);
                log.debug('itemPrice is' , itemPrice);
                log.debug('itemTax is' , itemTax);
                log.debug('itemAmount is' , itemAmount);
                log.debug('Break' , '---------------------');
                */
            }
    
            var salesOrder = record.create({
                    type: record.Type.CASH_SALE,
                    isDynamic: true
                });
            salesOrder.setText({fieldId: 'entity', value: customerName});
            salesOrder.setText({fieldId: 'location', value: location});
            salesOrder.setText({fieldId: 'memo', value: notes});
            salesOrder.setText({fieldId: 'location', value: location});

    } catch (error) {
        log.error('ERROR' , error);
    }
        
    }

    function reduce(context) {
        // Your reduce logic here
    }

    function summarize(summary) {
        // Your summarize logic here
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});

