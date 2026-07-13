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
            var response = https.get({
                url: 'https://api.foodics.com/v5/orders?include=payments.payment_method,customer,products.product,branch &sort=reference&filter[reference]=426600',
                "headers": {
                    "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImY1OTg4NTY4MThjNDY2MzI1MDNhNWQzZGUzMzU2MDU5MTczZDEzZjIxMWNlYTNjYjM0OTZjMmVhNGJhMGI1OTg4ZWNkMjMzZWI4MDhhNDMzIn0.eyJhdWQiOiI5MGQ1YTcxOC1lMzBkLTQ5ODYtODY0Ni0wNjdlZDBkMzdkMGUiLCJqdGkiOiJmNTk4ODU2ODE4YzQ2NjMyNTAzYTVkM2RlMzM1NjA1OTE3M2QxM2YyMTFjZWEzY2IzNDk2YzJlYTRiYTBiNTk4OGVjZDIzM2ViODA4YTQzMyIsImlhdCI6MTY1NTgwMTgzMSwibmJmIjoxNjU1ODAxODMxLCJleHAiOjE4MTM1NjgyMzEsInN1YiI6Il9kNzQxMTRkNyIsInNjb3BlcyI6WyJnZW5lcmFsLnJlYWQiLCJvcmRlcnMubGlzdCJdLCJidXNpbmVzcyI6IjkwMzBkNTM0LTRjYjktNDQwMi1hYTBjLTcwNzY5YTU4NWQ0NCIsInJlZmVyZW5jZSI6IjM1NTYxNyJ9.WCdIzk0rbd1tlEev7VTb0WXIaxpIM8sOogylHKviXECKQEbVhR5esnX2vW2mjCxg5Bjg71PaCI5b2AeLt7XmwyS8BVzFBrwSl8vtDA4c6nQ9nWuuA7F1frbIEdNe-VybsSeVnuqn-05kLU2NjlK2U9fcrm4aQeLbCtCB8nbmNiJJXMhk_EEnSIfB6p26SpJvXrbmnnfcdtIhwIJJiQxYrh6tcchOMeMLnbr6XJWiJd9jnWT67ZZUkE9MW9U55v6diofkOOk7igOiqFvgtuSYxT9dTLxXBn1WBjEiY1VW644KR_i324Q1NiS7iw_Rtal3GT2sG_NnzcHR4GL35hjH8Qbufce3hB9rPiK0Dejx_rY8sgm3ITHQ4ArTJGRNmV5B3FaHqJuMynXNjshM5BRA7mFlf30Rj_WXxsJmkHW8F_S6Cw8MWqv_eqLdrgkf4nlPtdWYOgxsgcLzfzew7BYrGo9fZ2ekU_8mQVKOlBnuVXBckEbZPzOcU4D5HK0a0dzmT3VZLlXGAbviY5WRLB8ngMu9fBOoHmv1oczH0NgVfxz7Sa035IY4xNSMHT4CWaQYgdlgK2Ww6AEnnBqtcvwiLJ-n-i9Z-eGvUBKjzAe7vBSNPOwUIOWV9gqxZnDWC2Ax95o-hgE9V1ZwAi9hld8LAtUG0YRwYL5DuNP6A4SWXk4"
                }
            })
            var parseBody = JSON.parse(response.body.toString());

            return parseBody.data;
        }

        /**
         * Executes when the map entry point is triggered and applies to each key/value pair.
         *
         * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
         * @since 2015.1.0
         */

        function map(context) {
            var parseData = JSON.parse(context.value);
            var objRecord;
            var products = parseData.products;
            var product;
            var paymentMethod;
            var branch;
            var itemUnitPrice;
            var quantity;
            var orderNumber;

            log.debug('products array', products)

            if (parseData.hasOwnProperty('payments')) {
                paymentMethod = parseData.payments[0].payment_method.id;
            }

            if (parseData.hasOwnProperty('branch')) {
                branch = parseData.branch.id;
            }
            log.debug("branch", branch);
            log.debug('pay', paymentMethod);
            try {
                var customerSearchObj = search.create({
                    type: "customer",
                    filters:
                        [
                            ["custentity_vs_custfoodics_id", "is", paymentMethod]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "Internal ID" })
                        ]
                });

                var custResults = customerSearchObj.run().getRange({ start: 0, end: 1 });

                if (custResults.length < 1) {
                    throw new Error('Customer was not found');
                }

                var custId = custResults[0].id;
                log.debug('custId', custId);
                
                var locationSearchObj = search.create({
                    type: "location",
                    filters:
                        [
                            ["custrecord_5826_loc_branch_id", "is", branch]
                        ],
                    columns:
                        [

                        ]
                });

                var branchResults = locationSearchObj.run().getRange({ start: 0, end: 1 });

                if (branchResults.length < 1) {
                    throw new Error('Branch was not found');
                }   

                var branchId = branchResults[0].id;
                log.debug("Branch Id", branchId);

            } catch (e) {
                log.error('error', JSON.stringify(e));
            }

            try {
                var objRecord = record.create({ type: record.Type.INVOICE, isDynamic: true });
                objRecord.setValue({ fieldId: 'entity', value: custId });
                objRecord.setValue({ fieldId: 'location', value: branchId });
                log.debug('Cust ID', custId);
                orderNumber = parseData.reference;
                objRecord.setValue({ fieldId: 'custbody_vs_order_number', value: orderNumber });
                //    	 	objRecord.setValue({fieldId: 'entity', value: 236});
                //			objRecord.setValue({fieldId: 'subsidiary', value: orderDetails['subsidiary']});
                //    	 	objRecord.setValue({fieldId: 'subsidiary', value: 2});
                //			
                //			if(orderDetails['driver'] != 'NONE')
                //			objRecord.setValue({fieldId: 'cseg2', value: orderDetails['driver']});
                //			
                //if(branchId!= undefined)
                //objRecord.setValue({fieldId: 'location', value: 216});
                //					
                //			if(orderDetails['memo'] != 'NONE')
                //				objRecord.setValue({fieldId: 'memo', value: orderDetails['memo']});
                //			
                //			objRecord.setValue({fieldId: 'cseg1', value: orderDetails['trackNum']});
                //			
                //			if(orderDetails['vehicle']!='NONE')
                //			objRecord.setValue({fieldId: 'class', value: orderDetails['vehicle']});
                //			
                //			//objRecord.setValue({fieldId: 'orderstatus', value: 'B'});
                //			
                //			var date = orderDetails['createDate'].split('-');
                //			date = date[0]+'/'+date[1]+'/'+(Number(date[2])+2000);
                //			log.audit('date is: '+date);
                //			//d m y
                //			
                //			 var date = format.parse({
                //			 value: date ,
                //			 type: format.Type.DATE
                //			 });
                //			 
                //			 var formattedDateString = format.format({
                //			 value: date,
                //			 type: format.Type.DATE
                //			 });
                //			
                //			objRecord.setValue({fieldId: 'trandate', value: date});
                //			objRecord.setValue({fieldId: 'custbody_termsfrommiles', value: orderDetails['term']});
                //			j
                for (var line = 0; line < products.length; line++) {

                    product = parseData.products[line].product.sku;
                    log.debug('Product ', product);
                    var itemSearchObj = search.create({
                        type: "item",
                        filters:
                            [
                                ["custitem_vs_sku_code", "is", product]
                                //["custitem_vs_sku_code","is",'22012102']
                                //["custitem_vs_sku_code","is",'19011804']
                            ],
                        columns:
                            [

                            ]
                    });

                    var itemResult = itemSearchObj.run().getRange({ start: 0, end: 1 });

                    if (itemResult.length < 1) {
                        throw new Error('Item was not found');
                    }

                    var itemID = itemResult[0].id;
                    log.debug(itemResult[0]);
                    itemUnitPrice = parseData.products[line].tax_exclusive_unit_price;

                    quantity = parseData.products[line].quantity;

                    //				var data=String(items[line]).split('@@');

                    objRecord.selectNewLine({ sublistId: 'item' });

                    objRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemID });
                    objRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: quantity });
                    objRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: itemUnitPrice });

                    log.debug('itemUnitPrice', itemUnitPrice);

                    objRecord.commitLine({ sublistId: 'item' });

                }

                //			if(charges > 0 )
                //				{
                //				objRecord.selectNewLine({sublistId: 'item'});
                //				
                //				objRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'item', value: 708});
                //				objRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'quantity', value: 1});
                //				objRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: charges});		
                //			
                //				objRecord.commitLine({sublistId: 'item'});
                //				}
                //			
                objRecord.save();
            } catch (e) {
                log.error('error in invoice creation', e.message);
            }
        }

        /**
         * Executes when the reduce entry point is triggered and applies to each group.
         *
         * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
         * @since 2015.1
         */
        function reduce(context) {

        }


        /**
         * Executes when the summarize entry point is triggered and applies to the result set.
         *
         * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
         * @since 2015.1
         */
        function summarize(summary) {

        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };

    });
