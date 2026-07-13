/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search','N/runtime'],
  /**
   * @param {record} record
   * @param {search} search
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
            
            var rectype = scriptObj.getParameter({name: 'custscript_vs_transtype'});
            var recid = scriptObj.getParameter({name: 'custscript_vs_transid'});
  
              var newRecord = record.load({type:rectype,id:recid});

              var internalID = newRecord.getValue({fieldId: "tranid"});
              var subsidiary = newRecord.getValue({fieldId: "subsidiary"});
              var isCheckboxChecked = newRecord.getValue({fieldId: "custbody_vs_cia_pos",});
              var adjustmentAccount = newRecord.getValue({fieldId: "account"});
              var location = newRecord.getValue({fieldId: "location"});
              var date = newRecord.getValue({ fieldId: "trandate" });
              var approvalStatus = newRecord.getValue({fieldId: "custbody_vs_approvalstatus",});
              var recordID = newRecord.id;
              var itemCount = newRecord.getLineCount({sublistId: "item",});
              var invCreated = newRecord.getValue({ fieldId: "custbody_vs_inventoryadjustmentcreated" });
  
      
            // Check if Data is correct or not
              log.debug({title: 'subsidiary is:' , details: subsidiary});
              log.debug({title: 'isCheckboxChecked is:' , details: isCheckboxChecked});
              log.debug({title: 'adjustmentAccount is:' , details: adjustmentAccount});
              log.debug({title: 'location is:' , details: location});
              log.debug({title: 'date is:' , details: date});
              log.debug({title: 'recordID is:' , details: recordID});
              log.debug({title: 'itemCount is:' , details: itemCount});
              // log.debug({title: 'approvalStatus is:' , details: approvalStatus});
  
            // If the checkbox is checked then it will enter this loop and create Inventory Adjustment
            // if (approvalStatus == 2 && !invCreated) {
            if (!invCreated) {
              newRecord.setValue({fieldId:'custbody_vs_inventoryadjustmentcreated',value:true});
                log.debug({ title: "CheckBox Condition", details: isCheckboxChecked });
      
                var inventoryAdjustment = record.create({type: record.Type.INVENTORY_ADJUSTMENT,isDynamic: true,});
          
                  inventoryAdjustment.setValue({fieldId: "subsidiary",value: subsidiary,});
                  inventoryAdjustment.setValue({fieldId: "custbody_vs_source",value: "POS - " + internalID,});
                  inventoryAdjustment.setValue({fieldId: "account",value: adjustmentAccount,});
                  inventoryAdjustment.setValue({fieldId: "trandate",value: date,});
                  inventoryAdjustment.setValue({fieldId: "adjlocation",value: location,});
      

                for (var i = 0; i < itemCount; i++) {
                  var itemId = newRecord.getSublistValue({sublistId: "item",fieldId: "item",line: i,});
                  var itemQty = newRecord.getSublistValue({sublistId: "item",fieldId: "quantity",line: i,});
                  var inventoryDetailSubrecord = newRecord.getSublistSubrecord({sublistId: 'item',fieldId: 'inventorydetail',line: i});
                  var inventoryDetailCount = inventoryDetailSubrecord.getLineCount({sublistId: 'inventoryassignment'});
  
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
      
                  log.debug('Item Type is:', itemType);
                  log.debug('isLotItem:', isLotItem);
                  log.debug('isSerialItem:', isSerialItem);
      
                  inventoryAdjustment.selectNewLine({ sublistId: "inventory" });
            
                  inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "item", value: itemId });
                  inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "adjustqtyby", value: -itemQty });
                  inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "location", value: location });
  
                  if ((itemType == "InvtPart" && (isLotItem == true || isSerialItem == true))) {
                      var inventoryDetail = inventoryAdjustment.getCurrentSublistSubrecord({sublistId: 'inventory',fieldId: 'inventorydetail'});
  
                      for (var j = 0; j < inventoryDetailCount; j++) {
                          inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });
  
                          var quantity = inventoryDetailSubrecord.getSublistValue({sublistId: 'inventoryassignment',fieldId: 'quantity',line: j});
                          var status = inventoryDetailSubrecord.getSublistValue({sublistId: 'inventoryassignment',fieldId: 'status',line: j});
                          var issueInventoryNumber = inventoryDetailSubrecord.getSublistValue({sublistId: 'inventoryassignment',fieldId: 'issueinventorynumber',line: j});
                          var expirationDate = inventoryDetailSubrecord.getSublistValue({sublistId: 'inventoryassignment',fieldId: 'expirationdate',line: j});
  
                          inventoryDetail.setCurrentSublistValue({sublistId: 'inventoryassignment',fieldId: 'quantity',value: -quantity});
                          inventoryDetail.setCurrentSublistValue({sublistId: 'inventoryassignment',fieldId: 'status',value: status});
                          inventoryDetail.setCurrentSublistValue({sublistId: 'inventoryassignment',fieldId: 'issueinventorynumber',value: issueInventoryNumber});
                          inventoryDetail.setCurrentSublistValue({sublistId: 'inventoryassignment',fieldId: 'expirationdate',value: expirationDate});
  
                          inventoryDetail.commitLine({ sublistId: 'inventoryassignment' });
                      }
                  }
  
                  inventoryAdjustment.commitLine({ sublistId: "inventory" });
              }
                  
                  var adjustmentId = inventoryAdjustment.save();
                  newRecord.save();
                  log.debug({title: "Inventory Adjustment Created" , details: "Adjustment ID: " + adjustmentId});
            }
        
      } catch (error) {
        log.error({title: 'ERROR!!!!' , details: error});
        
      }
  
      }
  
      return {
          execute: execute
      };
      
  });
  