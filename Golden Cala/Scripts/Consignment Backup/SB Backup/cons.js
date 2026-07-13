/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/runtime', 'N/file', 'N/search', 'N/error', 'N/format', 'N/log', 'N/task'],
    /**
 * @param{record} record
 */
    (record, runtime, file, search, error, format, log, task) => {

        /*Get item id - return a flag if it is a lot numbered item or not.*/
        function get_item_lot_number_flag(item_id) {
            try {
                var itemFields = search.lookupFields({
                    type: search.Type.ITEM,
                    id: item_id,
                    columns: ['islotitem']
                });
                //log.debug('is lot', is_lot_number);
                return itemFields.islotitem;
            }
            catch (e) {
                log.error('get_item_lot_number_flag error ', e);
            }
        }

        function get_inventory_detail(qty, item, location) {
            try {
                var inventorydetailSearchObj = search.create({
                    type: "inventorydetail",
                    filters:
                        [
                            ["quantity", "greaterthanorequalto", qty],
                            "AND",
                            ["item", "anyof", item],
                            "AND",
                            ["location", "anyof", location]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "inventorynumber", sort: search.Sort.ASC, label: " Number" }),
                            search.createColumn({ name: "binnumber", label: "Bin Number" }),
                            search.createColumn({ name: "quantity", label: "Quantity" }),
                            search.createColumn({ name: "itemcount", label: "Item Count" }),
                            search.createColumn({ name: "expirationdate", sort: search.Sort.ASC, label: "Expiration Date" })
                        ]
                });
                var inventory_detail_res = inventorydetailSearchObj.run().getRange({ start: 0, end: 1 });
                return inventory_detail_res[0];
            }
            catch (e) {
                log.error('get_inventory_detail ', e);
            }
        }


        /*Nahdi functions*/
        /*Get month and year like Sep-23 and return the date as last date of the month like 30/9/2023*/
        function getLastDayOfMonthAbb(monthYear) {
            var parts = monthYear.split('-');
            var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            var monthIndex = monthNames.indexOf(parts[0]);
            var year = parseInt(parts[1], 10) + 2000; // Adjusting for YY format

            var date = new Date(year, monthIndex + 1, 0); // Month is 0-indexed, 0 as day gives last day of previous month
            return date;
        }

        /*pass item id as parameter to get the lens type (from items -> brand field)*/
        function get_lens_type(itemid) {
            try {
                log.audit('item id lens', itemid);
                var lens_type_lookup_field = search.lookupFields({
                    type: search.Type.ITEM,
                    id: itemid,
                    columns: ['custitem28']
                });
                //log.debug('lens_type_lookup_field', lens_type_lookup_field);
                log.debug('lens_type_lookup_field.custitem28[0].text', lens_type_lookup_field.custitem28[0].text);
                return lens_type_lookup_field.custitem28[0].text;
            }
            catch (e) {
                log.error('get_lens_type+', e);
            }
        }

        function get_store_name_and_city(store_code, client_name) {
            /*store_code = '8418',
            client_name = ''*/
            try {
                var customrecord_vs_add_new_store_consrepSearchObj = search.create({
                    type: "customrecord_vs_add_new_store_consrep",
                    filters:
                        [
                            ["custrecord_vs_consrep_client", "anyof", "4"],
                            "AND",
                            ["custrecord_vs_consrep_storecode", "is", "2103"]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "scriptid", label: "Script ID" }),
                            search.createColumn({ name: "custrecord_vs_consrep_client", label: "Client" }),
                            search.createColumn({ name: "custrecord_vs_consrep_scode", label: "SCode From Sales" }),
                            search.createColumn({ name: "custrecord_vs_consrep_storecode", label: "Store Code" }),
                            search.createColumn({ name: "custrecord_vs_consrep_retailername", label: "RETAILER NAME" }),
                            search.createColumn({ name: "custrecord_vs_consrep_stores", label: "Stores" }),
                            search.createColumn({ name: "custrecord_vs_consrep_city", label: "City" }),
                            search.createColumn({ name: "custrecord_vs_consrep_area", label: "Area" }),
                            search.createColumn({ name: "custrecord_vs_consrep_city_ar_field", label: "City (Arabic)" }),
                            search.createColumn({ name: "custrecord_vs_consrep_province_field", label: "Province" }),
                            search.createColumn({ name: "custrecord_vs_consrep_store_type", label: "Store Type" })
                        ]
                });

                var customrecord_vs_add_new_store_consrepSearchRes = customrecord_vs_add_new_store_consrepSearchObj.run().getRange({ start: 0, end: 1 });
                var store_name = customrecord_vs_add_new_store_consrepSearchRes[0].getValue('custrecord_vs_consrep_stores');
                var city = customrecord_vs_add_new_store_consrepSearchRes[0].getValue('custrecord_vs_consrep_city');
                var region = customrecord_vs_add_new_store_consrepSearchRes[0].getValue('custrecord_vs_consrep_area');
                var retailer = customrecord_vs_add_new_store_consrepSearchRes[0].getValue('custrecord_vs_consrep_retailername');
                return [store_name, city, region, retailer];

            }
            catch (e) {
                log.debug('store name and city error', e);
            }
        }


        //Dawaa
        function getLastDayOfMonth(dateString) {
            // Parse the year and month from the input string
            var year = parseInt(dateString.substring(0, 4), 10);
            var month = parseInt(dateString.substring(4, 6), 10);

            // Create a date object for the first day of the next month
            var firstDayNextMonth = new Date(year, month, 1);

            // Subtract one day to get the last day of the required month
            var lastDay = new Date(firstDayNextMonth - 1);

            // Format the date
            var formattedDate = ('0' + lastDay.getDate()).slice(-2) + '/' +
                ('0' + (lastDay.getMonth() + 1)).slice(-2) + '/' +
                lastDay.getFullYear();
            formattedDate = format.parse({
                value: formattedDate,
                type: format.Type.DATE
            });

            return formattedDate;
        }



        var price_object = null;
        function get_item_price(_customer_name, _item_internal_id) {
            try {
                var customerSearchObj = search.create({
                    type: "customer",
                    filters:
                        [
                            ["companyname", "is", "Magrabi Optical Company"],
                            "AND",
                            ["pricingitem", "anyof", "2919"]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "itempricingunitprice", label: "Item Pricing Unit Price" }),
                            search.createColumn({ name: "pricingitem", label: "Pricing Item" })
                        ]
                });
                price_object = customerSearchObj.run().getRange({ start: 0, end: 1 });
                return price_object[0].getValue('itempricingunitprice');
            } catch (error) {
                log.error('get_item_price error', error);
            }
        }

        function mergeTransactions(transactions) {
            let merged = {};
        
            transactions.forEach(transaction => {
                let key = `${transaction.line_data.item_id}_${transaction.line_data.store_code}_${transaction.line_data.lens_type}_${transaction.line_data.company_name}`;
        
                if (!merged[key]) {
                    merged[key] = { ...transaction };
                    merged[key].line_data.qty = parseFloat(transaction.line_data.qty);
                } else {
                    merged[key].line_data.qty += parseFloat(transaction.line_data.qty);
                }
            });
        
            return Object.values(merged).map(transaction => {
                transaction.line_data.qty = transaction.line_data.qty.toString();
                return transaction;
            });
        }


        const getInputData = (inputContext) => {
            var scriptObj = runtime.getCurrentScript();
            //log.debug('scriptObj', scriptObj);
            var parameterValue = scriptObj.getParameter({ name: 'custscript_vs_cons_file_id' });
            //log.debug('parameterValue', parameterValue);
            var parameter_parts = parameterValue.split('/');
            var file_id = parameter_parts[0];
            var customer_id = parameter_parts[1];

            var cons_file = file.load({
                id: file_id
            });


            fileName = cons_file.name;
            fileType = cons_file.fileType;
            var contents = cons_file.getContents();

            var customer_name = "";


            var lines = contents.split('\n');
            var fields = "";
            var lines_data = [];


            if (customer_id == 4) {
                log.debug('23');
                customer_name = 'Magrabi';
                for (var i = 1; i < lines.length; i++) {
                    if (lines[i] != '') {

                        fields = lines[i].split(',');
                        // var inv_detail = get_inventory_detail(fields[3], fields[1], 35);
                        lines_data.push({
                            'customer_id': 365,
                            'location': 35,
                            'line_data': {
                                'date': fields[0],
                                'client_id_in_list': '4',
                                'item_id': fields[1],
                                'item_description': fields[2],
                                'qty': fields[3],
                                'store_code': fields[4],
                                'lens_type': '',
                                'company_name': fields[9],
                                'is_lot': '',
                                'price': '',
                                'inv_detail': ''

                            },
                        });
                    }
                }
            }

            //log.debug('lines data', lines_data);
            return lines_data;
        }

        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */

        const map = (mapContext) => {
            /*log.debug('map');*/
            try {
                var data = JSON.parse(mapContext.value);
                var inv_detail = JSON.stringify(get_inventory_detail(data.line_data.qty, data.line_data.item_id, data.location));
                log.debug('inv_detail', inv_detail);
                data.line_data['inv_detail'] = inv_detail;
                var lens_type = get_lens_type(data.line_data.item_id);
                data.line_data['lens_type'] = lens_type;
                data.line_data.is_lot = get_item_lot_number_flag(data.line_data.item_id);
                data.line_data['store_name'] = get_store_name_and_city(data.line_data.store_code, data.line_data.client_id_in_list);
                data.line_data['price'] = get_item_price(data.line_data.customer_id, data.line_data.item_id);
                log.audit('data', data);
                mapContext.write(data.customer_id, data);

            }
            catch (e) {
                log.error('map error', e);
            }

        }

        /**
         * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
         * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
         * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
         *     provided automatically based on the results of the map stage.
         * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
         *     reduce function on the current group
         * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
         * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} reduceContext.key - Key to be processed during the reduce stage
         * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
         *     for processing
         * @since 2015.2
         */

        const reduce = (reduceContext) => {
            log.debug('entered');

            var transactions = reduceContext.values.map(JSON.parse);
            log.debug('Transactions', transactions);

            transactions = mergeTransactions(transactions);


            if (true/*transactions[0].customer_id == 2576*/) {

                //Magrabi...................
                try {

                    var invoice = record.create({
                        type: record.Type.INVOICE,
                        isDynamic: false
                    });

                    log.debug('location11', transactions[0].location);
                    log.debug('transactions[0].customer_id', transactions[0].customer_id);

                    invoice.setValue({ fieldId: 'entity', value: transactions[0].customer_id }); // Replace 365 with the appropriate entity ID
                    invoice.setValue({ fieldId: 'subsidiary', value: 2 }); // Replace 2 with the appropriate subsidiary ID
                    invoice.setValue({ fieldId: 'location', value: transactions[0].location });

                    var content = "";
                    content = transactions;
                    for (var i = 0; i < transactions.length; i++) {

                        /*content += transactions[i].line_data.item_id + ',' + transactions[i].line_data.qty + ',' +
                            transactions[i].line_data.item_description + ',' + Number(transactions[i].line_data.qty) * 1 + ',' +
                            transactions[i].line_data.lens_type + ',' + ',' + transactions[i].line_data.store_name[0] + ',' +
                            transactions[i].line_data.store_name[2] + ',' + transactions[i].line_data.store_code + ',' + transactions[i].line_data.is_lot + ',' + 35 + ','
                            + 365 + ',' + transactions[i].line_data.inv_detail + ','
                            + transactions[i].line_data.price + '\n';*/

                        // Adding line item to the invoice
                        invoice.setSublistValue({ sublistId: 'item', fieldId: 'item', value: transactions[i].line_data.item_id, line: i });
                        invoice.setSublistValue({ sublistId: 'item', fieldId: 'quantity', value: transactions[i].line_data.qty, line: i });
                        invoice.setSublistValue({ sublistId: 'item', fieldId: 'rate', value: transactions[i].line_data.price, line: i }); // Assuming rate is in fields[2]
                        invoice.setSublistValue({ sublistId: 'item', fieldId: 'location', value: transactions[i].location, line: i });

                        if (transactions[i].line_data.is_lot) { // Adjust the condition as per your data structure
                            //var inv_detail = get_inventory_detail(fields[1], fields[0], 35); // Update the function call as needed
                            log.debug('entered inv detail');
                            var subrec = invoice.getSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line: i });
                            subrec.setSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: 216, line: 0 });
                            subrec.setSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: transactions[i].line_data.qty, line: 0 });
                        }

                    }
                    var rec_save = invoice.save();

                    if(rec_save){
                        log.debug('success', rec_save);
                    }
                    else{
                        log.debug('OMG');
                    }





                    log.audit('content', content);
                    /*var newFile = file.create({
                        name: 'example.txt',
                        fileType: file.Type.PLAINTEXT,
                        contents: content
                    });
                    newFile.folder = 1926; // Replace with your folder ID
                    var fileId = newFile.save();

                    var scriptTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: 'customscript_second_map_reduce', // Replace with your script ID
                        deploymentId: 'customdeploy_second_map_reduce', // Replace with your deployment ID
                        params: {
                            custscript_file_id: fileId
                        }
                    });

                    var scriptTaskId = scriptTask.submit()*/;

                }

                catch (e2) {
                    log.error('create line error', e2);
                }
            }

        }


        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (summaryContext) => {
        }

        return { getInputData, map, reduce, summarize }

    });