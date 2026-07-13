/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log', 'N/runtime', 'N/format'],
    function(search, record, log, runtime, format) {

        function getInputData() {
try {
                // First, delete all existing records of customrecord_vs_automatic_po_items
                deleteExistingRecords();
            
                var inventorySearch = search.create({
                    type: "inventorybalance",
                    filters: [
                        ["item.custitem_vs_do_not_buy_new", "is", "F"],
                        // "AND",
                        // ["item", "anyof", "42799"],
                        "AND", 
                        ["status","anyof","1"]
                    ],
                    columns: [
                        search.createColumn({ name: "item", summary: "GROUP", label: "Item" }),
                        search.createColumn({ name: "onhand", summary: "SUM", label: "On Hand" }),
                        search.createColumn({ name: "vendor", join: "item", summary: "GROUP", label: "Preferred Vendor" }),
                        search.createColumn({ name: "location", summary: "GROUP", label: "Warehouse" }),
                        search.createColumn({ name: "status", summary: "GROUP", label: "Status" }),
                        search.createColumn({ name: "class", join: "item", summary: "GROUP", label: "Profit Center" })
                    ]
                });
            
                // // Log the results of the search
                // inventorySearch.run().each(function(result) {
                //     log.debug({
                //         title: 'Inventory Search Result',
                //         details: JSON.stringify({
                //             item: result.getValue({ name: "item", summary: "GROUP" }),
                //             onHand: result.getValue({ name: "onhand", summary: "SUM" }),
                //             vendor: result.getValue({ name: "vendor", join: "item", summary: "GROUP" }),
                //             location: result.getValue({ name: "location", summary: "GROUP" }),
                //             status: result.getValue({ name: "status", summary: "GROUP" }),
                //             profitCenter: result.getValue({ name: "class", join: "item", summary: "GROUP" })
                //         })
                //     });
                //     return true; // Continue to the next result
                // });
            
                return inventorySearch;
} catch (error) {
    log.error('ERRORRRR!!' , 'Error in getInputData')
}
        }
        

        function map(context) {
            var result = JSON.parse(context.value);

            // Extracting values from search results
            var itemId = result.values['GROUP(item)'].value;
            var onHandQty = parseFloat(result.values['SUM(onhand)']);
            var vendorField = result.values['GROUP(vendor.item)'];
            var vendorId = vendorField && vendorField.value ? vendorField.value : null;
            var locationId = result.values['GROUP(location)'].value;
            var status = result.values['GROUP(status)'].value;
            var profitCenter = result.values['GROUP(class.item)'].value;

            // Initialize variables for GoodQty, DamagedQty, ExpiredQty
            var GoodQty = 0, DamagedQty = 0, ExpiredQty = 0;

            // Assign On Hand Quantity to respective variable based on Status
            if (status === "1") {
                GoodQty = onHandQty;
            } else if (status === "2") {
                DamagedQty = onHandQty;
            } else if (status === "5") {
                ExpiredQty = onHandQty;
            }

            var openPoQtyValue = openPoQty(itemId, locationId);
            var netQty = (onHandQty - DamagedQty - ExpiredQty) + openPoQtyValue;

            // Retrieve unitPerBox and threshold from custom record search
            var unitPerBox, threshold;
            try {
                var customSearchResults = search.create({
                    type: "customrecord_vs_itemminmaxquantity",
                    filters: [
                        ["custrecord_vs_itemminmax", "anyof", itemId],
                        "AND",
                        ["custrecord_vs_locationminmax", "anyof", locationId]
                    ],
                    columns: [
                        search.createColumn({name: "custrecord_vs_min", label: "Min Quantity"}),
                        search.createColumn({name: "custrecord_vs_maxquantity", label: "Max Quantity"}),
                        search.createColumn({name: "custrecord_vs_unitperbox", label: "No of unit per box"}),
                        search.createColumn({name: "custrecord_vs_threshould", label: "Threshould"})
                    ]
                }).run().getRange({start: 0, end: 1});

                if (customSearchResults.length > 0) {
                    var searchResult = customSearchResults[0];
                    unitPerBox = parseFloat(searchResult.getValue('custrecord_vs_unitperbox')) || 1;
                    threshold = parseFloat(searchResult.getValue('custrecord_vs_threshould')) || 0;
                    var minQty = parseFloat(searchResult.getValue('custrecord_vs_min')) || 0;
                    var maxQty = parseFloat(searchResult.getValue('custrecord_vs_maxquantity')) || 0;

                    var suggestedOrderQty = netQty <= minQty ? maxQty - netQty : 0;
                    var thresholdDecimal = threshold / 1;
                } else {
                    log.error('No Custom Record Found', 'Item ID: ' + itemId + ', Location ID: ' + locationId);
                    return;
                }

            } catch (error) {
                log.error('Error Retrieving Custom Record Data', 'Item ID: ' + itemId + ' | Error: ' + error.message);
                return;
            }

            // Calculate the suggested PO quantity using the function
            var moqPOQuantity = calculateMOQPOQuantity(onHandQty, unitPerBox, threshold);
            var newQty1 = newQty(onHandQty, openPoQtyValue, unitPerBox, minQty, maxQty);

            // New item fulfillment search (for past 6 months)
            var today = new Date();
            var sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(today.getMonth() - 6);

            var formattedToday = format.format({value: today, type: format.Type.DATE});
            var formattedSixMonthsAgo = format.format({value: sixMonthsAgo, type: format.Type.DATE});

            var itemFulfillmentSearchObj = search.create({
                type: "itemfulfillment",
                filters: [
                    ["type", "anyof", "ItemShip"],
                    "AND",
                    ["item", "anyof", itemId],
                    "AND",
                    ["trandate", "within", formattedSixMonthsAgo, formattedToday]
                ],
                columns: [
                    search.createColumn({name: "item", summary: "GROUP", label: "Item"}),
                    search.createColumn({name: "quantity", summary: "SUM", label: "Quantity"})
                ]
            });

            var fulfillmentResults = itemFulfillmentSearchObj.run().getRange({start: 0, end: 1});
            var quantitySum = 0;
            if (fulfillmentResults.length > 0) {
                quantitySum = parseFloat(fulfillmentResults[0].getValue({name: "quantity", summary: "SUM"})) || 0;
            }

            var months = (suggestedOrderQty / (quantitySum / 6));

            try {
                // Create custom record: customrecord_vs_automatic_po_items
                var poRecord = record.create({type: 'customrecord_vs_automatic_po_items', isDynamic: true});

                poRecord.setValue({fieldId: 'custrecord_vs_po_item', value: itemId});
                poRecord.setValue({fieldId: 'custrecord_vs_inventory_balance', value: onHandQty});
                poRecord.setValue({fieldId: 'custrecord_vs_mo_quantity', value: moqPOQuantity});
                poRecord.setValue({fieldId: 'custrecord_vs_suggested_order_quantity', value: suggestedOrderQty});
                poRecord.setValue({fieldId: 'custrecord_vs_automatic_location', value: locationId});
                poRecord.setValue({fieldId: 'custrecord_vs_threshold', value: thresholdDecimal});
                poRecord.setValue({fieldId: 'custrecord_vs_unit_per_box', value: unitPerBox});
                poRecord.setValue({fieldId: 'custrecord_vs_min_quantity', value: minQty});
                poRecord.setValue({fieldId: 'custrecord_vs_max_quantity', value: maxQty});
                poRecord.setValue({fieldId: 'custrecord_vs_profit_center', value: profitCenter});
                poRecord.setValue({fieldId: 'custrecord_vs_new_quantity', value: parseFloat(newQty1)});
                // poRecord.setValue({fieldId: 'custrecord_vs_number_of_months', value: months});

                if (vendorId) {
                    poRecord.setValue({fieldId: 'custrecord_vs_preferred_supplier', value: vendorId});
                }
                
                var recordId = poRecord.save();
                log.debug('Record Created', 'Record ID: ' + recordId);

            } catch (error) {
                log.error('Error creating custom record', error.message);
            }
        }

        function summarize(summary) {
            summary.mapSummary.errors.iterator().each(function(key, error, executionNo) {
                log.error({
                    title: 'Map Error for key: ' + key,
                    details: error + ' | Execution No: ' + executionNo
                });
                return true;
            });

            log.audit('Summary', 'Total Keys Processed: ' + summary.reduceSummary.keysProcessed);
        }

        function deleteExistingRecords() {
            var customRecordSearch = search.create({
                type: 'customrecord_vs_automatic_po_items',
                filters: [],
                columns: ['internalid']
            });

            customRecordSearch.run().each(function(result) {
                try {
                    record.delete({type: 'customrecord_vs_automatic_po_items', id: result.id});
                    log.debug('Deleted Record', 'Record ID: ' + result.id);
                } catch (error) {
                    log.error('Error Deleting Record', 'Record ID: ' + result.id + ' | Error: ' + error.message);
                }
                return true;
            });
        }

        function openPoQty(itemId, locationId) {
            var purchaseorderSearchObj = search.create({
                type: "purchaseorder",
                filters: [
                    ["type", "anyof", "PurchOrd"],
                    "AND",
                    ["item", "anyof", itemId],
                    "AND",
                    ["location", "anyof", locationId],
                    "AND",
                    ["status", "anyof", ["PurchOrd:B", "PurchOrd:E"]],
                    "AND",
                    ["mainline", "is", "F"],
                    "AND",
                    ["taxline", "is", "F"],
                    "AND", 
                    ["approvalstatus","anyof","2"]
                ],
                columns: [
                    search.createColumn({ name: "item", summary: "GROUP", label: "Item" }),
                    search.createColumn({ name: "formulanumeric", summary: "SUM", formula: "{quantity}-{quantityshiprecv}", label: "Formula (Numeric)" })
                ]
            });

            var searchResults = purchaseorderSearchObj.run().getRange({start: 0, end: 1});
            if (searchResults.length > 0) {
                return parseFloat(searchResults[0].getValue({name: "formulanumeric", summary: "SUM"})) || 0;
            } else {
                return 0;
            }
        }

        function calculateMOQPOQuantity(onHandQty, unitPerBox, threshold) {
            if (onHandQty < unitPerBox) {
                return unitPerBox;
            } else {
                var quotient = onHandQty / unitPerBox;
                var decimalPart = quotient - Math.floor(quotient);
                var intPart = Math.floor(quotient);
                var thresholdValue = threshold / 100;

                if (decimalPart > thresholdValue) {
                    return (unitPerBox * intPart) + unitPerBox;
                } else {
                    return unitPerBox * intPart;
                }
            }
        }

        function newQty(netQty, openPoQtyValue, unitPerBox, minQty, maxQty) {

            var totalOnHand = netQty;

            var initialOrder = (totalOnHand <= minQty) ? maxQty - totalOnHand : 0;

            var firstRound = 0;
            if(initialOrder <= unitPerBox && initialOrder > 0)
                {
                    firstRound = unitPerBox
                } else { 
                    firstRound= floor(initialOrder,unitPerBox)
                };

            var remainingFraction = 0;

            if(initialOrder - firstRound < 0){
                remainingFraction = 0;
            } else{
                remainingFraction = initialOrder - firstRound;
            }

            var remainingVsBox = 0;

            if (remainingFraction < 0) {
                remainingVsBox = remainingFraction / unitPerBox;
            } else {
                remainingVsBox = 0;
            }

            var secondRound = 0;

            if (remainingVsBox > 0.50 && remainingVsBox > 0){
                secondRound = unitPerBox;
            } else {
                secondRound = 0;
            }

            var finalOrder = firstRound + secondRound;
        
            return finalOrder;
        }

        // Custom floor function mimicking Excel's FLOOR with significance
        function floor(number, significance) {
            if (significance === 0) return 0; // Avoid division by zero
            return Math.floor(number / significance) * significance;
        }

        return {
            getInputData: getInputData,
            map: map,
            summarize: summarize
        };
    });
