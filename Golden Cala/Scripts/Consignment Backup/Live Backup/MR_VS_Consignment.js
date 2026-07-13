/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/runtime', 'N/file', 'N/search', 'N/error', 'N/format', 'N/log', 'N/task', 'N/email'],
    /**
 * @param{record} record
 */
    (record, runtime, file, search, error, format, log, task, email) => {
        var errors_content = '';

        /*Get item id - return a flag if it is a lot numbered item or not.*/
        function get_item_lot_number_flag(item_id) {
            if (!isNaN(item_id)) {
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
                    errors_content += `get_item_lot_number_flag(item_id) error ${e} item_id: ${item_id}`;
                    log.error('get_item_lot_number_flag error ', e);
                }
            }
        }

        var inventory_array;

        var itemInventoryMap = {};


        function get_inventory_detail(_location) {
            var inventorybalanceSearchObj = search.create({
                type: "inventorybalance",
                filters: [
                    ["location", "anyof", _location]
                ],
                columns: [
                    search.createColumn({ name: "item", label: "Item" }),
                    search.createColumn({ name: "inventorynumber", label: "Inventory Number" }),
                    search.createColumn({ name: "onhand", label: "On Hand" }),
                    search.createColumn({ name: "available", label: "Available" })
                ]
            });

            var resultsFull = [];
            var start_index = 0;
            var tresults = [];

            try {
                tresults = inventorybalanceSearchObj.run().getRange({ start: start_index, end: start_index + 1000 });
                resultsFull = resultsFull.concat(tresults);
                log.debug("Initial Results", tresults);
            } catch (ex) {
                errors_content += `error in initial fetch ${ex}`;
                log.error("Error in initial fetch", ex);
            }

            try {
                while (tresults.length === 1000) {
                    start_index += 1000;
                    tresults = inventorybalanceSearchObj.run().getRange({ start: start_index, end: start_index + 1000 });
                    resultsFull = resultsFull.concat(tresults);
                    log.debug("Additional Results", tresults);
                }
            } catch (ex) {
                errors_content += `error in pagination fetch ${ex}`;
                log.error("Error in pagination fetch", ex);
            }

            //log.audit('Total Results', resultsFull);

            var keyValueArray = [];

            for (var i = 0; i < resultsFull.length; i++) {
                var item = resultsFull[i];
                var itemId = item.getValue('item');
                var inventoryNumberValue = item.getValue('inventorynumber');
                var onhandValue = item.getValue('onhand');

                // Check for null values and continue if any are null
                if (itemId && inventoryNumberValue && onhandValue) {
                    var itemExists = false;

                    for (var j = 0; j < keyValueArray.length; j++) {
                        if (keyValueArray[j].itemId === itemId) {
                            // Add the inventory number and quantity as an object
                            keyValueArray[j].inventoryDetails.push({
                                [inventoryNumberValue]: parseInt(onhandValue, 10)
                            });
                            itemExists = true;
                            break;
                        }
                    }

                    if (!itemExists) {
                        keyValueArray.push({
                            itemId: itemId,
                            inventoryDetails: [
                                { [inventoryNumberValue]: parseInt(onhandValue, 10) }
                            ]
                        });
                    }
                }
            }

            log.audit('New Array', JSON.stringify(keyValueArray));

            return keyValueArray;
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
                //log.audit('item id lens', itemid);
                var lens_type_lookup_field = search.lookupFields({
                    type: search.Type.ITEM,
                    id: itemid,
                    columns: ['custitem28']
                });
                //log.debug('lens_type_lookup_field', lens_type_lookup_field);
                //log.debug('lens_type_lookup_field.custitem28[0].text', lens_type_lookup_field.custitem28[0].text);
                return lens_type_lookup_field.custitem28[0].text ? lens_type_lookup_field.custitem28[0].text : '';
            }
            catch (e) {
                errors_content += `get_lens_type(itemid) error: ${e} itemid: ${itemid}`;
                log.error('get_lens_type+', e);
            }
        }

        function get_store_name_and_city(store_code, client_name) {

            try {
                var customrecord_vs_add_new_store_consrepSearchObj = search.create({
                    type: "customrecord_vs_add_new_store_consrep",
                    filters: [
                        ["custrecord_vs_consrep_client", "anyof", client_name],
                        "AND",
                        ["custrecord_vs_consrep_storecode", "is", store_code]
                    ],
                    columns: [
                        search.createColumn({ name: "scriptid", label: "Script ID" }),
                        search.createColumn({ name: "custrecord_vs_consrep_client", label: "Client" }),
                        search.createColumn({ name: "custrecord_vs_consrep_scode", label: "SCode From Sales" }),
                        search.createColumn({ name: "custrecord_vs_consrep_storecode", label: "Store Code" }),
                        search.createColumn({ name: "custrecord_vs_consrep_retailername", label: "RETAILER NAME" }),
                        search.createColumn({ name: "custrecord_vs_consrep_stores", label: "Stores" }),
                        search.createColumn({ name: "custrecord_vs_consrep_city", label: "City" }),
                        search.createColumn({ name: "custrecord_vs_consrep_area", label: "Area" }),
                        search.createColumn({ name: "custrecord_vs_consrep_city_ar", label: "City (Arabic)" }),
                        search.createColumn({ name: "custrecord_vs_consrep_province", label: "Province" }),
                        search.createColumn({ name: "custrecord_vs_consrep_store_type", label: "Store Type" })
                    ]
                });
                
                var customrecord_vs_add_new_store_consrepSearchRes = customrecord_vs_add_new_store_consrepSearchObj.run().getRange({ start: 0, end: 1 });
                
                // Check if any result is returned
                if (customrecord_vs_add_new_store_consrepSearchRes && customrecord_vs_add_new_store_consrepSearchRes.length > 0) {
                    var store_name = customrecord_vs_add_new_store_consrepSearchRes[0].getValue('custrecord_vs_consrep_stores');
                    var city = customrecord_vs_add_new_store_consrepSearchRes[0].getValue('custrecord_vs_consrep_city');
                    var region = customrecord_vs_add_new_store_consrepSearchRes[0].getValue('custrecord_vs_consrep_area');
                    var retailer = customrecord_vs_add_new_store_consrepSearchRes[0].getValue('custrecord_vs_consrep_retailername');
                    return [store_name, city, region, retailer];
                } else {
                    // Handle the case where no results are found
                    return ['No store found', '', '', ''];
                }
                

            }
            catch (e) {
                errors_content += `get_store_name_and_city(store_code, client_name) error: ${e} store code: ${store_code} client name: ${client_name}`;
                log.error('store name and city error', e);
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
            if (!isNaN(_item_internal_id)) {
                try {
                    var customerSearchObj = search.create({
                        type: "customer",
                        filters:
                            [
                                ["entityid", "is", _customer_name],
                                "AND",
                                ["pricingitem", "anyof", _item_internal_id]
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
                    errors_content += error + '\n';
                    var fileObj = file.load({
                        id: 4858,
                        folder: 2256
                    });


                    var fileContent = fileObj.getContents();
                    fileObj.appendLine({ value: `get_item_price(_customer_name, _item_internal_id) error ${error} customer_name: ${_customer_name} item internal id: ${_item_internal_id}`, });

                    fileObj.save();
                    log.error('get_item_price error, item id: ', error + ' - ' + _item_internal_id);
                }
            }
        }

        /*function mergeTransactions(transactions) {
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
*/

        const getInputData = (inputContext) => {
            var scriptObj = runtime.getCurrentScript();
            //log.debug('scriptObj', scriptObj);
            var parameterValue = scriptObj.getParameter({ name: 'custscript_vs_cons_file_id2' });
            //log.debug('parameterValue', parameterValue);
            var parameter_parts = parameterValue.split('/');
            var file_id = parameter_parts[0];
            var customer_id = parameter_parts[1];
            log.audit(customer_id, file_id);

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


            if (customer_id == 29) {
                customer_name = 'Magrabi';

                for (var i = 1; i < lines.length; i++) {
                    if (lines[i] != '') {

                        fields = lines[i].split(',');
                        // var inv_detail = get_inventory_detail(fields[3], fields[1], 35);
                        lines_data.push({
                            'customer_id': 2576,
                            'customer_name': 'شركة مغربي للبصريات',
                            'location': 32,
                            'line_data': {
                                'date': fields[0],
                                'client_id_in_list': '29',
                                'item_id': fields[1],
                                'item_description': fields[2],
                                'qty': fields[3],
                                'store_code': fields[4],
                                'lens_type': '',
                                'company_name': fields[9],
                                'is_lot': '',
                                'price': '',
                                'inv_detail': 'N/A'
                            },
                        });
                    }
                }
            }

            else if (customer_id == 32) {
                //Dawaa.
                for (var i = 1; i < lines.length; i++) {
                    if (lines[i] != '') {
                        fields = lines[i].split(',');
                        // var inv_detail = get_inventory_detail(fields[3], fields[1], 35);
                        lines_data.push({
                            'customer_id': 2581,
                            'location': 36,
                            'line_data': {
                                'date': fields[5],
                                'client_id_in_list': '32',
                                'item_id': fields[1],
                                'item_description': fields[2],
                                'qty': fields[4],
                                'store_code': fields[0],
                                'lens_type': fields[7],
                                'company_name': fields[9],
                                'is_lot': '',
                                'price': '',
                                'inv_detail': ''
                            },
                        });
                    }
                }

            }

            else if (customer_id == 31) {
                //Faces.شلهوب
                for (var i = 1; i < lines.length; i++) {
                    if (lines[i] != '') {
                        lines_data.push({
                            'customer_id': 2533,
                            'customer_name': 'شركة مجموعة شلهوب العربية المحدودة',
                            'location': 38,
                            'line_data': {
                                'date': fields[0],
                                'client_id_in_list': '29',
                                'item_id': fields[1],
                                'item_description': fields[2],
                                'qty': fields[3],
                                'store_code': fields[4],
                                'lens_type': '',
                                'company_name': fields[9],
                                'is_lot': '',
                                'price': '',
                                'inv_detail': 'N/A'
                            },
                        });
                    }
                }
            }

            else if (customer_id == 30) {
                //Whites.
                for (var i = 1; i < lines.length; i++) {
                    if (lines[i] != '') {
                        lines_data.push({
                            'customer_id': 2580,
                            'location': 43,
                            'line_data': {
                                'date': fields[8],
                                'client_id_in_list': '30',
                                'item_id': fields[3],
                                'item_description': fields[4],
                                'qty': fields[6],
                                'store_code': fields[0],
                                'lens_type': fields[9],
                                'company_name': fields[9],
                                'is_lot': '',
                                'price': '',
                                'inv_detail': ''
                            },
                        });
                    }
                }
            }

            else if (customer_id == '') {
                //Eyewa.
                for (var i = 1; i < lines.length; i++) {
                    if (lines[i] != '') {
                        lines_data.push({
                            'customer_id': 2580,
                            'location': 37,
                            'line_data': {
                                'date': fields[10],
                                'client_id_in_list': '',
                                'item_id': fields[8],
                                'item_description': fields[0],
                                'qty': fields[3],
                                'store_code': fields[6],
                                'lens_type': fields[11],
                                //'company_name': fields[],
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


        const map = (mapContext) => {
            try {
                var data = JSON.parse(mapContext.value);
                var lens_type = get_lens_type(data.line_data.item_id);
                data.line_data['lens_type'] = lens_type;
                data.line_data.is_lot = get_item_lot_number_flag(data.line_data.item_id);
                if (get_item_lot_number_flag(data.line_data.item_id) == false) {
                    log.audit('item lot', data.line_data.item_id);
                }
                data.line_data['store_name'] = get_store_name_and_city(data.line_data.store_code, data.line_data.client_id_in_list);
                data.line_data['price'] = get_item_price(data.customer_name, data.line_data.item_id);
                mapContext.write(data.customer_id, data);

            }
            catch (e) {
                var fileObj = file.load({
                    id: 4858,
                    folder: 2256
                });

                // Modify the file content
                var fileContent = fileObj.getContents();
                fileObj.appendLine({
                    value: errors_content,
                });

                fileObj.save();
                log.error('map error', e);
            }

        }
        var content = "";
        const reduce = (reduceContext) => {
            var transactions = reduceContext.values.map(JSON.parse);
            log.debug('Transactions', transactions);

            //transactions = mergeTransactions(transactions);
            var subrec;
            if (transactions[0].customer_id == 2576) {
                // Magrabi...................
                try {
                    var inventory_balance = get_inventory_detail(32);

                    // Ensure inventory_balance is an array and has expected item structure
                    if (!inventory_balance || inventory_balance.length === 0) {
                        log.error('Inventory Balance Error', 'Inventory details are undefined or empty.');
                        return; // Exit if no inventory details are available
                    }

                    var invoice = record.create({
                        type: record.Type.INVOICE,
                        isDynamic: false
                    });
                    invoice.setValue({ fieldId: 'entity', value: transactions[0].customer_id });
                    invoice.setValue({ fieldId: 'subsidiary', value: 2 });
                    invoice.setValue({ fieldId: 'location', value: transactions[0].location });

                    for (var i = 0; i < transactions.length; i++) {
                        try {
                            // Set invoice line values
                            invoice.setSublistValue({ sublistId: 'item', fieldId: 'item', value: transactions[i].line_data.item_id, line: i });
                            invoice.setSublistValue({ sublistId: 'item', fieldId: 'quantity', value: transactions[i].line_data.qty, line: i });
                            invoice.setSublistValue({ sublistId: 'item', fieldId: 'rate', value: transactions[i].line_data.price, line: i }); // Assuming rate is in fields[2]
                            invoice.setSublistValue({ sublistId: 'item', fieldId: 'location', value: transactions[i].location, line: i });
                            invoice.setSublistValue({ sublistId: 'item', fieldId: 'location', value: transactions[i].location, line: i });
                            invoice.setSublistValue({ sublistId: 'item', fieldId: 'location', value: transactions[i].location, line: i });
                            //invoice.setSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_storename', value: transactions[i].store_name[0]?transactions[i].store_name[0]: '', line: i });
                            //invoice.setSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_consrep_region', value: transactions[i].store_name[2]? transactions[i].store_name[2]: '', line: i });

                            // Check if the item is a lot item
                            if (transactions[i].line_data.is_lot) {
                                var requestedQuantity = transactions[i].line_data.qty;
                                var inventoryNumbersForRequest = [];
                                var totalQuantityNeeded = requestedQuantity;
                                var itemId = transactions[i].line_data.item_id;

                                // Find matching item in inventory_balance
                                var itemInventory = inventory_balance.find(item => item.itemId === itemId);

                                if (!itemInventory) {
                                    var fileObj = file.load({ id: 4858, folder: 2256 });
                                    var fileContent = fileObj.getContents();
                                    fileObj.appendLine({ value: `Inventory Error No inventory found for item ID: ${itemId}`, });
                                    fileObj.save();
                                    log.error('Inventory Error', 'No inventory found for item ID: ' + itemId);
                                    continue; // If no inventory found, skip this transaction
                                }

                                // Iterate over the inventory details to calculate the required inventory numbers and quantities
                                for (var k = 0; k < itemInventory.inventoryDetails.length && totalQuantityNeeded > 0; k++) {
                                    var inventoryNumberObj = itemInventory.inventoryDetails[k];

                                    for (var inventoryNumber in inventoryNumberObj) {
                                        var availableQty = parseInt(inventoryNumberObj[inventoryNumber], 10);

                                        if (availableQty > 0) {  // Only use lots with available quantities
                                            var usedQty = Math.min(availableQty, totalQuantityNeeded);

                                            inventoryNumbersForRequest.push({ inventoryNumber: inventoryNumber, quantity: usedQty });
                                            inventoryNumberObj[inventoryNumber] -= usedQty; // Update the quantity after deduction
                                            totalQuantityNeeded -= usedQty;

                                            if (totalQuantityNeeded <= 0) {
                                                break; // Exit loop if the required quantity is fulfilled
                                            }
                                        }
                                    }
                                }

                                // If there are no valid inventory assignments, log an error for this item
                                if (inventoryNumbersForRequest.length === 0) {
                                    var fileObj = file.load({ id: 4858, folder: 2256 });
                                    var fileContent = fileObj.getContents();
                                    fileObj.appendLine({ value: `Inventory Assignment Error', 'No valid inventory assignments could be made for item: ${JSON.stringify(error)} ${itemId}`, });
                                    fileObj.save();
                                    log.error('Inventory Assignment Error', 'No valid inventory assignments could be made for item ' + itemId);
                                    continue; // Skip this transaction if no assignments are possible
                                }

                                // Apply the inventory assignments to the subrecord
                                var subrec = invoice.getSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line: i });

                                for (var j = 0; j < inventoryNumbersForRequest.length; j++) {
                                    var inventoryAssignment = inventoryNumbersForRequest[j];
                                    var inventory_number = inventoryAssignment.inventoryNumber;
                                    var quantity = inventoryAssignment.quantity;

                                    if (!inventory_number || quantity <= 0) {
                                        var fileObj = file.load({ id: 4858, folder: 2256 });
                                        fileObj.appendLine({ value: `get_item_price(_customer_name, _item_internal_id) error ${error} item internal id: ${itemId}`, });
                                        fileObj.save();
                                        log.error('Invalid Assignment', 'Invalid assignment for item ID: ' + itemId + ', Inventory number: ' + inventory_number + ', Quantity: ' + quantity);
                                        continue; // Skip invalid assignments
                                    }

                                    // Set the inventory number and quantity
                                    subrec.setSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: inventory_number, line: j });
                                    subrec.setSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: quantity, line: j });
                                }
                            }
                        } catch (e) {
                            errors_content += e + '\n';
                            var fileObj = file.load({
                                id: 4858,
                                folder: 2256
                            });
                            var fileContent = fileObj.getContents();
                            fileObj.appendLine({ value: `Processing error ${JSON.stringify(error)} item internal id: ${transactions[i].line_data.item_id}`, });

                            fileObj.save();
                            log.error('Error in Processing Item', 'Item ID: ' + transactions[i].line_data.item_id + ', Error: ' + e.message);
                        }
                    }
                    var save_invoice = invoice.save();
                    if (save_invoice) {
                        log.debug('Record Saved', save_invoice);
                    } else {

                        log.error('Record Not Saved');
                    }
                } catch (e2) {
                    errors_content += e + '\n';
                    log.error('Create Line Error', JSON.stringify(e2));
                }

            }





            if (transactions[0].customer_id == 2533) {
                // Faces...................
                try {

                    var inventory_balance = get_inventory_detail(38);
                    log.audit('var inventory_balance = get_inventory_detail(38);', inventory_balance);
                    // Ensure inventory_balance is an array and has expected item structure
                    if (!inventory_balance || inventory_balance.length === 0) {
                        log.error('Inventory Balance Error', 'Inventory details are undefined or empty.');
                        return; // Exit if no inventory details are available
                    }
                    
                    var invoice = record.create({
                        type: record.Type.INVOICE,
                        isDynamic: false
                    });
                    
                    invoice.setValue({ fieldId: 'entity', value: transactions[0].customer_id });
                    invoice.setValue({ fieldId: 'subsidiary', value: 2 });
                    invoice.setValue({ fieldId: 'location', value: transactions[0].location });
                    
                    for (var i = 0; i < transactions.length; i++) {
                        try {
                            
                            // Set invoice line values
                            invoice.setSublistValue({ sublistId: 'item', fieldId: 'item', value: transactions[i].line_data.item_id, line: i });
                            invoice.setSublistValue({ sublistId: 'item', fieldId: 'quantity', value: transactions[i].line_data.qty, line: i });
                            invoice.setSublistValue({ sublistId: 'item', fieldId: 'rate', value: transactions[i].line_data.price, line: i }); // Assuming rate is in fields[2]
                            invoice.setSublistValue({ sublistId: 'item', fieldId: 'location', value: transactions[i].location, line: i });
                            invoice.setSublistValue({ sublistId: 'item', fieldId: 'location', value: transactions[i].location, line: i });
                            invoice.setSublistValue({ sublistId: 'item', fieldId: 'location', value: transactions[i].location, line: i });
                            //invoice.setSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_storename', value: transactions[i].store_name[0]?transactions[i].store_name[0]: '', line: i });
                            //invoice.setSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_consrep_region', value: transactions[i].store_name[2]? transactions[i].store_name[2]: '', line: i });
                            
                            // Check if the item is a lot item
                            if (transactions[i].line_data.is_lot) {
                                
                                var requestedQuantity = transactions[i].line_data.qty;
                                var inventoryNumbersForRequest = [];
                                var totalQuantityNeeded = requestedQuantity;
                                var itemId = transactions[i].line_data.item_id;
                                
                                // Find matching item in inventory_balance
                                var itemInventory = inventory_balance.find(item => item.itemId === itemId);
                                
                                if (!itemInventory) {
                                    log.audit(9);
                                    var fileObj = file.load({ id: 4858, folder: 2256 });
                                    var fileContent = fileObj.getContents();
                                    fileObj.appendLine({ value: `Inventory Error No inventory found for item ID: ${itemId}`, });
                                    fileObj.save();
                                    log.error('Inventory Error', 'No inventory found for item ID: ' + itemId);
                                    continue; // If no inventory found, skip this transaction
                                }
                                
                                // Iterate over the inventory details to calculate the required inventory numbers and quantities
                                for (var k = 0; k < itemInventory.inventoryDetails.length && totalQuantityNeeded > 0; k++) {
                                    var inventoryNumberObj = itemInventory.inventoryDetails[k];
                                    
                                    for (var inventoryNumber in inventoryNumberObj) {
                                        var availableQty = parseInt(inventoryNumberObj[inventoryNumber], 10);

                                        if (availableQty > 0) {  // Only use lots with available quantities
                                            var usedQty = Math.min(availableQty, totalQuantityNeeded);
                                            
                                            inventoryNumbersForRequest.push({ inventoryNumber: inventoryNumber, quantity: usedQty });
                                            inventoryNumberObj[inventoryNumber] -= usedQty; // Update the quantity after deduction
                                            totalQuantityNeeded -= usedQty;

                                            if (totalQuantityNeeded <= 0) {
                                                break; // Exit loop if the required quantity is fulfilled
                                            }
                                        }
                                    }
                                }

                                // If there are no valid inventory assignments, log an error for this item
                                if (inventoryNumbersForRequest.length === 0) {
                                    var fileObj = file.load({ id: 4858, folder: 2256 });
                                    var fileContent = fileObj.getContents();
                                    fileObj.appendLine({ value: `Inventory Assignment Error', 'No valid inventory assignments could be made for item: ${JSON.stringify(error)} ${itemId}`, });
                                    fileObj.save();
                                    
                                    log.error('Inventory Assignment Error', 'No valid inventory assignments could be made for item ' + itemId);
                                    continue; // Skip this transaction if no assignments are possible
                                }

                                // Apply the inventory assignments to the subrecord
                                var subrec = invoice.getSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line: i });
                                
                                for (var j = 0; j < inventoryNumbersForRequest.length; j++) {
                                    var inventoryAssignment = inventoryNumbersForRequest[j];
                                    var inventory_number = inventoryAssignment.inventoryNumber;
                                    var quantity = inventoryAssignment.quantity;
                                    if (!inventory_number || quantity <= 0) {
                                        
                                        var fileObj = file.load({ id: 4858, folder: 2256 });
                                        fileObj.appendLine({ value: `get_item_price(_customer_name, _item_internal_id) error ${error} item internal id: ${itemId}`, });
                                        fileObj.save();
                                        log.error('Invalid Assignment', 'Invalid assignment for item ID: ' + itemId + ', Inventory number: ' + inventory_number + ', Quantity: ' + quantity);
                                        continue; // Skip invalid assignments
                                    }
                                    // Set the inventory number and quantity
                                    subrec.setSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: inventory_number, line: j });
                                    subrec.setSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: quantity, line: j });
                                }
                            }
                        } catch (e) {
                            errors_content += e + '\n';
                            var fileObj = file.load({
                                id: 4858,
                                folder: 2256
                            });
                            var fileContent = fileObj.getContents();
                            fileObj.appendLine({ value: `Processing error ${JSON.stringify(error)} item internal id: ${transactions[i].line_data.item_id}`, });

                            fileObj.save();
                            log.error('Error in Processing Item', 'Item ID: ' + transactions[i].line_data.item_id + ', Error: ' + e.message);
                        }
                    }
                    try{
                    var save_invoice = invoice.save();
                    }
                    catch(ex){
                        var fileObj = file.load({
                            id: 4858,
                            folder: 2256
                        });
                        var fileContent = fileObj.getContents();
                        fileObj.appendLine({ value: 'Invoice Not Saved error: ' + JSON.stringify(ex) });
                        log.error('Create line error', ex);
                    }
                    
                } catch (e2) {
                    errors_content += e + '\n';
                    log.error('Create Line Error', JSON.stringify(e2));
                }

            }
        };


        const summarize = (summaryContext) => {
        }

        return { getInputData, map, reduce, summarize }

    });