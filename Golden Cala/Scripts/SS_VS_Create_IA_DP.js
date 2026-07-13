/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/runtime'],
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
              var rectype = scriptObj.getParameter({ name: 'custscript_vs_type_dp' });
              var recid = scriptObj.getParameter({ name: 'custscript_vs_id_dp' });

              // Load the record
              var newRecord = record.load({ type: rectype, id: recid });

              // Extract values from the record
              var subsidiary = newRecord.getValue({ fieldId: "subsidiary" });
              var adjustmentAccount = newRecord.getValue({ fieldId: "account" });
              var location = newRecord.getValue({ fieldId: "location" });
              var date = newRecord.getValue({ fieldId: "trandate" });
              var approvalStatus = newRecord.getValue({ fieldId: "custbody_vs_approvalstatus" });
              var recordID = newRecord.id;
              var itemCount = newRecord.getLineCount({ sublistId: "item" });
              var invCreated = newRecord.getValue({ fieldId: "custbody_vs_inventoryadjustmentcreated" });
              var tranid = newRecord.getValue({ fieldId: "tranid" });

              log.debug('tranid', tranid);

              // Check if Data is correct or not
              // log.debug({title: 'subsidiary is:' , details: subsidiary});
              // log.debug({title: 'adjustmentAccount is:' , details: adjustmentAccount});
              // log.debug({title: 'location is:' , details: location});
              // log.debug({title: 'date is:' , details: date});
              // log.debug({title: 'recordID is:' , details: recordID});
              // log.debug({title: 'itemCount is:' , details: itemCount});
              // log.debug({title: 'approvalStatus is:' , details: approvalStatus});

              if ( approvalStatus == 2 && !invCreated) {
              // if (!invCreated) {
                  // Update the checkbox to avoid redundant processing
                  record.submitFields({
                      type: rectype,
                      id: recid,
                      values: { custbody_vs_inventoryadjustmentcreated: true }
                  });

                  // Create Inventory Adjustment record
                  var inventoryAdjustment = record.create({
                      type: record.Type.INVENTORY_ADJUSTMENT,
                      isDynamic: true,
                  });

                  inventoryAdjustment.setValue({ fieldId: "subsidiary", value: subsidiary });
                  inventoryAdjustment.setValue({ fieldId: "account", value: adjustmentAccount });
                  // inventoryAdjustment.setValue({ fieldId: "trandate", value: date }); // Optional
                  inventoryAdjustment.setValue({ fieldId: "adjlocation", value: location });

                  // Loop through the items in the original record
                  for (var i = 0; i < itemCount; i++) {
                      var itemId = newRecord.getSublistValue({ sublistId: "item", fieldId: "item", line: i });
                      var itemQty = newRecord.getSublistValue({ sublistId: "item", fieldId: "quantity", line: i });
                      var inventoryDetailSubrecord = newRecord.getSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line: i });
                      var inventoryDetailCount = inventoryDetailSubrecord.getLineCount({ sublistId: 'inventoryassignment' });

                      // Add the item to the Inventory Adjustment
                      inventoryAdjustment.selectNewLine({ sublistId: "inventory" });
                      log.debug('Item is:', itemId);
                      inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "item", value: itemId });
                      inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "adjustqtyby", value: -itemQty });
                      inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "location", value: location });

                      var onhand = inventoryAdjustment.getCurrentSublistValue({ sublistId: "inventory", fieldId: "onhand" });
                      var items = inventoryAdjustment.getCurrentSublistValue({ sublistId: "inventory", fieldId: "item" });
                      log.debug("ON hand " + onhand, " Item " + items);
                      log.debug("qty " + itemQty, " Item " + items);

                      // Handle serialized or lot-numbered items
                      if (inventoryDetailCount > 0) {
                          var inventoryDetail = inventoryAdjustment.getCurrentSublistSubrecord({ sublistId: 'inventory', fieldId: 'inventorydetail' });

                          for (var j = 0; j < inventoryDetailCount; j++) {
                              inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });

                              var quantity = inventoryDetailSubrecord.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', line: j });
                              var status = inventoryDetailSubrecord.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'status', line: j });
                              var issueInventoryNumber = inventoryDetailSubrecord.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', line: j });
                              var expirationDate = inventoryDetailSubrecord.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'expirationdate', line: j });

                              inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: -quantity });
                              inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'status', value: status });
                              inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: issueInventoryNumber });
                              inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'expirationdate', value: expirationDate });

                              inventoryDetail.commitLine({ sublistId: 'inventoryassignment' });
                          }
                      }

                      inventoryAdjustment.commitLine({ sublistId: "inventory" });
                  }

                  // Set custom source field and save the Inventory Adjustment record
                  inventoryAdjustment.setValue({ fieldId: "custbody_vs_source", value: "DP - " + tranid });
                  var adjustmentId = inventoryAdjustment.save();
                  log.debug({ title: "Inventory Adjustment Created", details: "Adjustment ID: " + adjustmentId });
              }

          } catch (error) {
              log.error({ title: 'ERROR!!!!', details: error });
          }
      }

      return {
          execute: execute
      };
  });
