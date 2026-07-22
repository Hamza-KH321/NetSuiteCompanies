/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/runtime'],
    /**
     * @param {record} record
     * @param {search} search
     * @param {runtime} runtime
     */
    function(record, search, runtime) {
       
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
    
              try {
                var recid = scriptObj.getParameter({name: 'custscript_vs_transid'});
                var rectype = scriptObj.getParameter({name: 'custscript_vs_transactiontype'});
      
                // log.debug('Record Type is:', rectype);
                // log.debug('Record ID is:', recid);
      
                // Get data from Transaction Record POS
                var newRecord = record.load({type: rectype, id: recid});
      
              } catch (error) {
                log.error('ERROR!!!', error);
              }
    
              var subsidiary = newRecord.getValue({ fieldId: "subsidiary" });
              var approvalStatus = newRecord.getValue({ fieldId: "custbody_vs_approvalstatus" });
              var adjustmentAccount = newRecord.getValue({ fieldId: "account" });
              var location = newRecord.getValue({ fieldId: "location" });
              var recordID = newRecord.id;
              var itemCount = newRecord.getLineCount({ sublistId: "item" });
              var documentNumber = newRecord.getValue({ fieldId: "tranid" });
              var department = newRecord.getValue({ fieldId: "csegvs_dep" });
              var brand = newRecord.getValue({ fieldId: "class" });
              var areaLocation = newRecord.getValue({ fieldId: "department" });
              var invCreated = newRecord.getValue({ fieldId: "custbody_vs_invnetoryadjustmentcreated" });
              var customer = newRecord.getValue({ fieldId: "entity" });
              var memo = newRecord.getValue({ fieldId: "memo" });
    
              if (approvalStatus == "2" && !invCreated) {
                newRecord.setValue({fieldId:'custbody_vs_invnetoryadjustmentcreated',value:true});
                  var inventoryAdjustment = record.create({
                      type: record.Type.INVENTORY_ADJUSTMENT,
                      isDynamic: true,
                  });
              
                  // Adding Inventory Adjustment Body Fields
                  inventoryAdjustment.setValue({ fieldId: "subsidiary", value: subsidiary });
                  inventoryAdjustment.setValue({ fieldId: "account", value: '529' });
                  inventoryAdjustment.setValue({ fieldId: "adjlocation", value: location });
                  inventoryAdjustment.setValue({ fieldId: "department", value: areaLocation });
                  inventoryAdjustment.setValue({ fieldId: "class", value: brand });
                  inventoryAdjustment.setValue({ fieldId: "csegvs_dep", value: department });
                  inventoryAdjustment.setValue({ fieldId: "custbody_vs_source", value: 'Sample Request - ' + documentNumber });
                  inventoryAdjustment.setValue({ fieldId: "customer", value: customer});
                  inventoryAdjustment.setValue({ fieldId: "memo", value: memo});
          
                  // Adding Inventory Adjustment lines
                  for (var i = 0; i < itemCount; i++) {
                      var itemId = newRecord.getSublistValue({
                          sublistId: "item",
                          fieldId: "item",
                          line: i,
                      });
      
                      var itemQty = newRecord.getSublistValue({
                          sublistId: "item",
                          fieldId: "quantity",
                          line: i,
                      });
    
                      var inventoryDetailSubrecord = newRecord.getSublistSubrecord({
                          sublistId: 'item',
                          fieldId: 'inventorydetail',
                          line: i
                      });
    
                      var inventoryDetailCount = inventoryDetailSubrecord.getLineCount({
                          sublistId: 'inventoryassignment'
                      });
    
                      // This Saved search is used just to check the item type if it's Lot numbered item or not 
                      var itemSearchObj = search.create({
                          type: "item",
                          filters: ["internalid", "anyof", itemId],
                          columns: [
                              search.createColumn({name: "type", label: "Type"}),
                              search.createColumn({name: "internalid", label: "Internal ID"}),
                              search.createColumn({name: "salesdescription", label: "Description"}),
                              search.createColumn({name: "islotitem", label: "Is Lot Numbered Item"}),
                              search.createColumn({name: "isserialitem", label: "Is Serialized Item"})
                          ]
                      });
                
                      var itemSearchResult = itemSearchObj.run().getRange({ start: 0, end: 1 });
                      var itemResult = itemSearchResult[0];
                      var itemType = itemResult.getValue({ name: "type" });
                      var isLotItem = itemResult.getValue({ name: "islotitem" });
                      var isSerialItem = itemResult.getValue({ name: "isserialitem" });
          
                    //   log.debug('Item Type is:', itemType);
                    //   log.debug('isLotItem:', isLotItem);
                    //   log.debug('isSerialItem:', isSerialItem);
          
                      inventoryAdjustment.selectNewLine({ sublistId: "inventory" });
                
                      inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "item", value: itemId });
                      inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "adjustqtyby", value: -itemQty });
                      inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "location", value: location });
                      inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "department", value: areaLocation });
                      inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "class", value: brand });
                      inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "csegvs_dep", value: department });
    
                      if ((itemType == "InvtPart" && (isLotItem == true || isSerialItem == true))) {
                          var inventoryDetail = inventoryAdjustment.getCurrentSublistSubrecord({
                              sublistId: 'inventory',
                              fieldId: 'inventorydetail'
                          });
    
                          for (var j = 0; j < inventoryDetailCount; j++) {
                              inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });
    
                              var quantity = inventoryDetailSubrecord.getSublistValue({
                                  sublistId: 'inventoryassignment',
                                  fieldId: 'quantity',
                                  line: j
                              });
    
                              var status = inventoryDetailSubrecord.getSublistValue({
                                  sublistId: 'inventoryassignment',
                                  fieldId: 'status',
                                  line: j
                              });
    
                              var issueInventoryNumber = inventoryDetailSubrecord.getSublistValue({
                                  sublistId: 'inventoryassignment',
                                  fieldId: 'issueinventorynumber',
                                  line: j
                              });
    
                              var expirationDate = inventoryDetailSubrecord.getSublistValue({
                                  sublistId: 'inventoryassignment',
                                  fieldId: 'expirationdate',
                                  line: j
                              });
    
                              inventoryDetail.setCurrentSublistValue({
                                  sublistId: 'inventoryassignment',
                                  fieldId: 'quantity',
                                  value: -quantity // Make quantity negative
                              });
    
                              inventoryDetail.setCurrentSublistValue({
                                  sublistId: 'inventoryassignment',
                                  fieldId: 'status',
                                  value: status
                              });
    
                              inventoryDetail.setCurrentSublistValue({
                                  sublistId: 'inventoryassignment',
                                  fieldId: 'issueinventorynumber',
                                  value: issueInventoryNumber
                              });
    
                              inventoryDetail.setCurrentSublistValue({
                                  sublistId: 'inventoryassignment',
                                  fieldId: 'expirationdate',
                                  value: expirationDate
                              });
    
                              inventoryDetail.commitLine({ sublistId: 'inventoryassignment' });
                          }
                      }
    
                      inventoryAdjustment.commitLine({ sublistId: "inventory" });
                  }
                  
                  // Inventory Adjustment ID
                  var adjustmentId = inventoryAdjustment.save();
                  newRecord.save();
                  log.debug({title: "Inventory Adjustment Created", details: "Adjustment ID: " + adjustmentId});
              }
          
            } catch (error) {
                log.error({title: 'ERROR!!!!', details: error});
            }
        }
    
        return {
            execute: execute
        };
        
    });
    