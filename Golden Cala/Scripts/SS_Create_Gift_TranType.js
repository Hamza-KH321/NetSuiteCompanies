/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search','N/runtime', 'N/email'],
    /**
     * @param {record} record
     * @param {search} search
     */
    function(record, search, runtime, email) {
       
        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(scriptContext) {
            try {
                var scriptObj = runtime.getCurrentScript();     
                var rectype = scriptObj.getParameter({name: 'custscript_vs_type'});
                var recid = scriptObj.getParameter({name: 'custscript_vs_id'});
        
                // Load only necessary fields to minimize governance
                var newRecord = record.load({
                    type: rectype,
                    id: recid,
                    isDynamic: true,
                    columns: ['recordid', 'custrecord_vs_date_new', 'custrecord_vs_customer_new', 
                              'custrecord_vs_employee_new', 'custrecord_vs_location_new', 'custrecord_vs_notes_new', 
                              'custrecord_vs_iacreatedsuccessfully', 'customform', 'custrecord_vs_giftapprovalstatus']
                });
        
                var internalID = newRecord.getValue({fieldId: "recordid"});
                var date = newRecord.getValue({fieldId: "custrecord_vs_date_new"});
                var location = newRecord.getValue({fieldId: "custrecord_vs_location_new"});
                var headerNotes = newRecord.getValue({fieldId: "custrecord_vs_notes_new"});
                var IACreated = newRecord.getValue({fieldId: "custrecord_vs_iacreatedsuccessfully"});
                var custForm = newRecord.getValue({fieldId: "customform"});
                var itemCount = newRecord.getLineCount({sublistId: "recmachcustrecord_vs_parent_new"});
                var approvalStatus = newRecord.getValue({fieldId: "custrecord_vs_giftapprovalstatus"});
        
                if (approvalStatus == 2 && !IACreated) {
                    newRecord.setValue({fieldId: 'custrecord_vs_iacreatedsuccessfully', value: true});
        
                    var inventoryAdjustment = record.create({
                        type: record.Type.INVENTORY_ADJUSTMENT,
                        isDynamic: true,
                    });
        
                    inventoryAdjustment.setValue({fieldId: "subsidiary", value: 2});
                    inventoryAdjustment.setValue({fieldId: "custbody_vs_source", value: 'Gifts - ' + internalID});
                    inventoryAdjustment.setValue({fieldId: "memo", value: headerNotes});
        
                    // Optimize account setting
                    var accountMap = { '77': '816', '79': '833', '78': '767', '76': '798' };
                    inventoryAdjustment.setValue({ fieldId: "account", value: accountMap[custForm] || '' });
        
                    inventoryAdjustment.setValue({ fieldId: "trandate", value: date });
                    inventoryAdjustment.setValue({ fieldId: "adjlocation", value: location });
        
                    // Pre-fetch item types to avoid calling inside the loop
                    var itemTypeLookup = {};
                    for (var i = 0; i < itemCount; i++) {
                        var itemId = newRecord.getSublistValue({ sublistId: "recmachcustrecord_vs_parent_new", fieldId: "custrecord_vs_item_new", line: i });
                        if (!itemTypeLookup[itemId]) {
                            var itemType = search.lookupFields({ type: search.Type.ITEM, id: itemId, columns: ['type'] });
                            itemTypeLookup[itemId] = itemType.type[0].value;
                        }
                    }
        
                    for (var i = 0; i < itemCount; i++) {
                        var itemId = newRecord.getSublistValue({ sublistId: "recmachcustrecord_vs_parent_new", fieldId: "custrecord_vs_item_new", line: i });
                        var qty = newRecord.getSublistValue({ sublistId: "recmachcustrecord_vs_parent_new", fieldId: "custrecord_vs_quantity_new", line: i });
                        var memoLine = newRecord.getSublistValue({ sublistId: "recmachcustrecord_vs_parent_new", fieldId: "custrecord_vs_memoline_new", line: i });
                        var itemTypeValue = itemTypeLookup[itemId];
                    
                        inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "item", value: itemId });
                        inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "location", value: location });
                        inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "adjustqtyby", value: -qty });
                        inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "memo", value: memoLine });
                    
                        // Ensure inventory detail is configured only if necessary
                        if (itemTypeValue === 'lotnumberedinventoryitem' || itemTypeValue === 'InvtPart') {
                            handleInventoryDetail(inventoryAdjustment, itemId, qty, location);
                        }
                    
                        inventoryAdjustment.commitLine({ sublistId: "inventory" });
                    }
        
                    var adjustmentId = inventoryAdjustment.save();
                    newRecord.save();
                    log.debug({title: "Inventory Adjustment Created", details: "Adjustment ID: " + adjustmentId});
                }
            } catch (error) {
                log.error({title: 'ERROR!!!!', details: error});   
            }
        }
        
        function handleInventoryDetail(inventoryAdjustment, itemId, qty, location) {
            var inventoryDetail = inventoryAdjustment.getCurrentSublistSubrecord({
                sublistId: 'inventory',
                fieldId: 'inventorydetail'
            });
        
            var searchResults = search.create({
                type: "inventorynumber",
                filters: [
                    ["quantityavailable", "notequalto", "0"],
                    "AND",
                    ["item", "anyof", itemId],
                    "AND",
                    ["location", "anyof", location],
                    "AND",
                    [
                        ["inventorynumber", "doesnotcontain", "-D"],
                        "AND",
                        ["inventorynumber", "doesnotcontain", "-1"],
                        "AND",
                        ["inventorynumber", "doesnotcontain", "-AS"]
                    ]
                ],
                columns: ["inventorynumber", "quantityavailable", "internalid"]
            }).run().getRange({ start: 0, end: 100 });
        
            var totalQuantityAssigned = 0;
            for (var i = 0; i < searchResults.length && totalQuantityAssigned < qty; i++) {
                var result = searchResults[i];
                var available = parseFloat(result.getValue("quantityavailable"));
                if (available <= 0) continue;
        
                var lotNumberID = result.getValue("internalid");
                var quantityToAssign = Math.min(qty - totalQuantityAssigned, available);
        
                inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });
                inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: -quantityToAssign });
                inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: lotNumberID });
                inventoryDetail.commitLine({ sublistId: 'inventoryassignment' });
        
                totalQuantityAssigned += quantityToAssign;
            }
        }
        
    
        return {
            execute: execute
        };
        
    });
    