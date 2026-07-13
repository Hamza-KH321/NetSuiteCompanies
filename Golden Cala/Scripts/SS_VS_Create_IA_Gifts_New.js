/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search','N/runtime', 'N/email', 'N/format'],
    /**
     * @param {record} record
     * @param {search} search
     */
    function(record, search, runtime, email, format) {
       
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
                var rectype = scriptObj.getParameter({ name: 'custscript_vs_type' });
                var recid = scriptObj.getParameter({ name: 'custscript_vs_id' });
        
                log.debug('rectype', rectype);
                log.debug('recid', recid);
        
                var newRecord = record.load({
                    type: rectype,
                    id: recid,
                    isDynamic: true,
                    columns: [
                        'recordid', 'custrecord_vs_date_new', 'custrecord_vs_customer_new',
                        'custrecord_vs_employee_new', 'custrecord_vs_location_new', 'custrecord_vs_notes_new',
                        'custrecord_vs_iacreatedsuccessfully', 'customform', 'custrecord_vs_giftapprovalstatus'
                    ]
                });
        
                var internalID = newRecord.getValue({ fieldId: "recordid" });
                var date = newRecord.getValue({ fieldId: "custrecord_vs_date_new" });
                var location = newRecord.getValue({ fieldId: "custrecord_vs_location_new" });
                var headerNotes = newRecord.getValue({ fieldId: "custrecord_vs_notes_new" });
                var IACreated = newRecord.getValue({ fieldId: "custrecord_vs_iacreatedsuccessfully" });
                var custForm = newRecord.getValue({ fieldId: "customform" });
                var itemCount = newRecord.getLineCount({ sublistId: "recmachcustrecord_vs_parent_new" });
                var approvalStatus = newRecord.getValue({ fieldId: "custrecord_vs_giftapprovalstatus" });
                
                log.debug('Gift Data' , {
                    internalID:internalID,
                    date:date,
                    location:location,
                    headerNotes:headerNotes,
                    IACreated:IACreated,
                    custForm:custForm,
                    itemCount:itemCount,
                    approvalStatus:approvalStatus,
                })
        
                if (custForm == '186') {
                    approvalStatus = 2;
                }
        
                if (approvalStatus == 2 && !IACreated) {
                    var inventoryAdjustment = record.create({
                        type: record.Type.INVENTORY_ADJUSTMENT,
                        isDynamic: true,
                    });
        
                    inventoryAdjustment.setValue({ fieldId: "customform", value: 148 });
                    inventoryAdjustment.setValue({ fieldId: "subsidiary", value: 2 });
                    inventoryAdjustment.setValue({ fieldId: "custbody_vs_source", value: 'Gifts - ' + internalID });
                    inventoryAdjustment.setValue({ fieldId: "memo", value: headerNotes });
        
                    var accountMap = { '77': '816', '79': '833', '78': '767', '76': '798', '186': '800' };
                    inventoryAdjustment.setValue({ fieldId: "account", value: accountMap[custForm] || '' });
        
                    inventoryAdjustment.setValue({ fieldId: "trandate", value: date });
                    inventoryAdjustment.setValue({ fieldId: "adjlocation", value: location });
        
                    var itemQtyMap = {}; // Store itemId -> required qty
                    var itemTypeLookup = {}; // Store itemId -> item type
        
                    for (var i = 0; i < itemCount; i++) {
                        var itemId = newRecord.getSublistValue({
                            sublistId: "recmachcustrecord_vs_parent_new",
                            fieldId: "custrecord_vs_item_new",
                            line: i
                        });
                        var qty = newRecord.getSublistValue({
                            sublistId: "recmachcustrecord_vs_parent_new",
                            fieldId: "custrecord_vs_quantity_new",
                            line: i
                        });
        
                        itemQtyMap[itemId] = (itemQtyMap[itemId] || 0) + qty;
        
                        // if (!itemTypeLookup[itemId]) {
                        //     var itemType = search.lookupFields({ type: search.Type.ITEM, id: itemId, columns: ['type'] });
                        //     itemTypeLookup[itemId] = itemType.type[0].value;
                        // }
                    }
        
                    var lotNumberMap = getAvailableLotNumbers(itemQtyMap, location);

                    log.debug('lotNumberMap' , lotNumberMap);
        
                    for (var i = 0; i < itemCount; i++) {
                        var itemId = newRecord.getSublistValue({
                            sublistId: "recmachcustrecord_vs_parent_new",
                            fieldId: "custrecord_vs_item_new",
                            line: i
                        });
                        var qty = newRecord.getSublistValue({
                            sublistId: "recmachcustrecord_vs_parent_new",
                            fieldId: "custrecord_vs_quantity_new",
                            line: i
                        });
                        var memoLine = newRecord.getSublistValue({
                            sublistId: "recmachcustrecord_vs_parent_new",
                            fieldId: "custrecord_vs_memoline_new",
                            line: i
                        });
        
                        inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "item", value: itemId });
                        inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "location", value: location });
                        inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "adjustqtyby", value: -qty });
                        inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "memo", value: memoLine });
        
                        // if (itemTypeLookup[itemId] === 'lotnumberedinventoryitem' || itemTypeLookup[itemId] === 'InvtPart') {
                            assignLotNumbers(inventoryAdjustment, itemId, qty, lotNumberMap[itemId] || []);
                        // }
        
                        inventoryAdjustment.commitLine({ sublistId: "inventory" });
                    }
        
                    var adjustmentId = inventoryAdjustment.save();
                    newRecord.setValue({ fieldId: 'custrecord_vs_iacreatedsuccessfully', value: true });
                    newRecord.save();
                    log.debug({ title: "Inventory Adjustment Created", details: "Adjustment ID: " + adjustmentId });
                }
            } catch (error) {
                log.error({ title: 'ERROR!!!!', details: error });
            }
        }
        
        function getAvailableLotNumbers(itemQtyMap, location) {
            var itemIds = Object.keys(itemQtyMap);
        
            var searchResults = search.create({
                type: "inventorynumber",
                filters: [
                    ["quantityavailable", "greaterthan", "0"],
                    "AND",
                    ["item", "anyof"].concat(itemIds),
                    "AND",
                    ["location", "anyof", location],
                    "AND",
                    ["inventorynumber", "doesnotcontain", "-D"],
                    "AND",
                    ["inventorynumber", "doesnotcontain", "-1"],
                    "AND",
                    ["inventorynumber", "doesnotcontain", "-AS"]
                ],
                columns: ["inventorynumber", "quantityavailable", "internalid", "item"]
            }).run().getRange({ start: 0, end: 1000 });
        
            var lotNumberMap = {};
            searchResults.forEach(function (result) {
                var itemId = result.getValue("item");
                var lotId = result.getValue("internalid");
                var availableQty = parseFloat(result.getValue("quantityavailable"));
        
                if (!lotNumberMap[itemId]) {
                    lotNumberMap[itemId] = [];
                }
        
                lotNumberMap[itemId].push({ lotId: lotId, availableQty: availableQty });
            });
        
            return lotNumberMap;
        }
        
        function assignLotNumbers(inventoryAdjustment, itemId, qty, lotArray) {
            var totalAssigned = 0;
            for (var i = 0; i < lotArray.length && totalAssigned < qty; i++) {
                var lot = lotArray[i];
                var assignQty = Math.min(qty - totalAssigned, lot.availableQty);
                inventoryAdjustment.getCurrentSublistSubrecord({ sublistId: 'inventory', fieldId: 'inventorydetail' })
                    .selectNewLine({ sublistId: 'inventoryassignment' })
                    .setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: -assignQty })
                    .setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: lot.lotId })
                    .commitLine({ sublistId: 'inventoryassignment' });
        
                totalAssigned += assignQty;
            }
        }    
    
        return {
            execute: execute
        };
        
    });
    