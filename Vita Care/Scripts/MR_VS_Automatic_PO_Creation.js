/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/runtime', 'N/log'], 
    function(record, search, runtime, log) {

        function getInputData() {
            try {
        
                var pagedData = search.create({
                    type: "customrecord_vs_automatic_po_items",
                    filters: [
                        ["custrecord_vs_new_quantity", "greaterthan", "0"]
                    ],
                    columns: [
                        search.createColumn({name: "internalid", label: "Internal ID"}),
                        search.createColumn({name: "custrecord_vs_preferred_supplier", label: "Preferred Supplier"}),
                        search.createColumn({name: "custrecord_vs_automatic_location", label: "Location"}),
                        search.createColumn({name: "custrecord_vs_po_item", label: "PO Item"}),
                        search.createColumn({name: "custrecord_vs_mo_quantity", label: "MO Quantity"}),
                        search.createColumn({name: "custrecord_vs_profit_center", label: "Profit Center"}),
                        search.createColumn({name: "custrecord_vs_unit_per_box", label: "Unit per Box"}),
                        search.createColumn({name: "custrecord_vs_new_quantity", label: "New Quantity"}) 
                    ]
                }).runPaged({
                    pageSize: 1000
                });
        
        
                var allResults = [];
        
                pagedData.pageRanges.forEach(function(pageRange) {
                    var page = pagedData.fetch({ index: pageRange.index });
                    page.data.forEach(function(result) {
                        var profitCenterText = result.getText({ name: 'custrecord_vs_profit_center' }) || '';
                        var profitCenterGroup = profitCenterText.split(':')[0].trim(); // Get everything before the first colon
        
                        allResults.push({
                            internalid: result.getValue({ name: 'internalid' }),
                            supplierId: result.getValue({ name: 'custrecord_vs_preferred_supplier' }),
                            location: result.getValue({ name: 'custrecord_vs_automatic_location' }),
                            itemId: result.getValue({ name: 'custrecord_vs_po_item' }),
                            quantity: result.getValue({ name: 'custrecord_vs_new_quantity' }),
                            profitCenter: profitCenterGroup,
                            unitPerBox: result.getValue({ name: 'custrecord_vs_unit_per_box' })
                        });
                    });
                });

                return allResults;
            } catch (error) {
                log.error('ERROR in GetInputData Stage', error);
            }
        }

        function map(context) {
            try {
                var data = JSON.parse(context.value);
                var groupKey = data.supplierId + '_' + data.location + '_' + data.profitCenter;

                context.write({
                    key: groupKey,
                    value: {
                        itemId: data.itemId,
                        quantity: data.quantity,
                        unitPerBox: data.unitPerBox
                    }
                });
            } catch (error) {
                log.error('ERROR in Map Stage', error);
            }
        }

        function reduce(context) {
            try {
                // Parse the key to get supplierId, location, and profitCenter
                var keyParts = context.key.split('_');
                var supplierId = keyParts[0];
                var location = keyParts[1];
                var profitCenter = keyParts[2];

                // Get the list of items for this group
                var items = context.values.map(function(value) {
                    return JSON.parse(value);
                });

                // Get Active Purchase Contract for the Supplier
                var purchaseContractId = getPurchaseContract(supplierId);
                    
                if (purchaseContractId) {
                    var validItems = [];
                    items.forEach(function(item) {
                        var isValid = getValidItemsFromContract(purchaseContractId, supplierId, item.itemId);
                        if (isValid.length > 0) {
                            validItems.push(item);
                        }
                    });

                    if (validItems.length > 0) {
                        createPO(supplierId, location, profitCenter, validItems, purchaseContractId);
                    } else {
                        log.error('Invalid Items', 'No valid items found for supplier: ' + supplierId);
                    }
                } else {
                    log.error('No Purchase Contract', 'No active purchase contract found for supplier: ' + supplierId);
                }
            } catch (error) {
                log.error('ERROR in Reduce Stage', error);
            }
        }

        function getPurchaseContract(supplierId) {  
            try {
                var purchaseContractSearchObj = search.create({
                    type: "purchasecontract",
                    filters: [
                        ["type", "anyof", "PurchCon"], 
                        "AND", 
                        ["mainline", "is", "T"], 
                        "AND", 
                        ["vendor.internalid", "anyof", supplierId], 
                        "AND", 
                        [["enddate","after","today"],"OR",["enddate","isempty",""]]
                    ],
                    columns: [
                        search.createColumn({name: "internalid", label: "Internal ID"})
                    ]
                });
                
                var purchaseContractId = null;
                purchaseContractSearchObj.run().each(function(result) {
                    purchaseContractId = result.getValue('internalid');
                    return false; // Exit loop after finding the first result
                });
                return purchaseContractId;
            } catch (error) {
                log.error('ERROR in getPurchaseContract', error);
            }
        }

        function getValidItemsFromContract(purchaseContractId, supplierId, itemId) {
            try {
                var purchaseContractLinesSearchObj = search.create({
                    type: "purchasecontract",
                    filters: [
                        ["type", "anyof", "PurchCon"], 
                        "AND", 
                        ["mainline", "is", "F"], 
                        "AND", 
                        ["vendor.internalid", "anyof", supplierId], 
                        "AND", 
                        [["enddate","after","today"],"OR",["enddate","isempty",""]],
                        "AND", 
                        ["internalid", "anyof", purchaseContractId]
                    ],
                    columns: [
                        search.createColumn({name: "item", label: "Item"})
                    ]
                });
        
                var validItems = [];
                purchaseContractLinesSearchObj.run().each(function(result) {
                    var contractItemId = result.getValue('item');
                    
                    if (contractItemId == itemId) {
                        validItems.push(itemId);
                    }
                    return true;
                });
                return validItems;
            } catch (error) {
                log.error('ERROR in getValidItemsFromContract', error);
            }
        }

        function createPO(supplierId, location, profitCenter, validItems, purchaseContractId) {
            try {
                log.audit('createPO', 'Creating PO for supplier: ' + supplierId + ', location: ' + location + ', profitCenter: ' + profitCenter);
        
                var poRecord = record.create({
                    type: record.Type.PURCHASE_ORDER,
                    isDynamic: true
                });
        
                poRecord.setValue({ fieldId: 'entity', value: supplierId });
                poRecord.setValue({ fieldId: 'location', value: location });
                poRecord.setValue({ fieldId: 'custbody_vs_pc_choose', value: purchaseContractId });
                // poRecord.setValue({ fieldId: 'custbody_vs_automatic_po', value: '<div style="background-color: yellow; padding: 5px; font-weight: bold;">Automatic PO</div>' });
                poRecord.setValue({ fieldId: 'custbody_vs_automatic_po', value: true });
                
                validItems.forEach(function(item) {
                    log.debug('Setting Item Line', {
                        itemId: item.itemId,
                        quantity: item.quantity,
                        unitPerBox: item.unitPerBox
                    });
                    poRecord.selectNewLine({ sublistId: 'item' });
                    poRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: item.itemId });
                    poRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: item.quantity });
                    poRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_unit_per_box', value: item.unitPerBox });
                    poRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_new_qty', value: item.quantity });
                    poRecord.commitLine({ sublistId: 'item' });
                });
        
                var totalAmount = poRecord.getValue({ fieldId: 'total' });
                poRecord.setValue({ fieldId: 'custbody_vs_po_amount', value: totalAmount });
        
                var poId = poRecord.save();
                log.audit('PO Created', 'PO ID: ' + poId);
            } catch (error) {
                log.error('ERROR in createPO', error);
            }
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce
        };
    });
