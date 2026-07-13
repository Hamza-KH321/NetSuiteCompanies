/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log', 'N/search', 'N/runtime'], function (record, log, search, runtime) {

  function afterSubmit(context) {
    try {

      var newRecord = context.newRecord;
      var rectype = newRecord.type;
      var recid = newRecord.id;

      // Load full record
      var fullRecord = record.load({ type: rectype, id: recid });

      var subsidiary = fullRecord.getValue({ fieldId: "subsidiary" });
      var adjustmentAccount = fullRecord.getValue({ fieldId: "account" });
      var location = fullRecord.getValue({ fieldId: "location" });
      var date = fullRecord.getValue({ fieldId: "trandate" });
      var approvalStatus = fullRecord.getValue({ fieldId: "custbody_vs_approvalstatus" });
      var tranid = fullRecord.getValue({ fieldId: "tranid" });
      var invCreated = fullRecord.getValue({ fieldId: "custbody_vs_inventoryadjustmentcreated" });
      var itemCount = fullRecord.getLineCount({ sublistId: "item" });

      log.debug('Data', {
        subsidiary: subsidiary,
        adjustmentAccount: adjustmentAccount,
        location: location,
        approvalStatus: approvalStatus,
        tranid: tranid,
        invCreated: invCreated,
        itemCount: itemCount,
      })

      if (approvalStatus == 2 && !invCreated) {

        var inventoryAdjustment = record.create({ type: record.Type.INVENTORY_ADJUSTMENT, isDynamic: true });

        inventoryAdjustment.setValue({ fieldId: "subsidiary", value: subsidiary });
        inventoryAdjustment.setValue({ fieldId: "account", value: adjustmentAccount });
        inventoryAdjustment.setValue({ fieldId: "adjlocation", value: location });

        for (var i = 0; i < itemCount; i++) {
          var itemId = fullRecord.getSublistValue({ sublistId: "item", fieldId: "item", line: i });
          var itemQty = fullRecord.getSublistValue({ sublistId: "item", fieldId: "quantity", line: i });

          var inventoryDetailSubrecord = fullRecord.getSublistSubrecord({
            sublistId: 'item',
            fieldId: 'inventorydetail',
            line: i
          });

          var inventoryDetailCount = inventoryDetailSubrecord.getLineCount({ sublistId: 'inventoryassignment' });

          inventoryAdjustment.selectNewLine({ sublistId: "inventory" });
          inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "item", value: itemId });
          inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "adjustqtyby", value: -itemQty });
          inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "location", value: location });

          if (inventoryDetailCount > 0) {
            var inventoryDetail = inventoryAdjustment.getCurrentSublistSubrecord({
              sublistId: 'inventory',
              fieldId: 'inventorydetail'
            });

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

        var adjustmentId = inventoryAdjustment.save();

        if (adjustmentId) {
          var loadedAdjustment = record.load({
            type: record.Type.INVENTORY_ADJUSTMENT,
            id: adjustmentId
          });

          loadedAdjustment.setValue({ fieldId: "custbody_vs_source", value: "DP - " + tranid });
          loadedAdjustment.save();
        }


        record.submitFields({
          type: rectype,
          id: recid,
          values: { custbody_vs_inventoryadjustmentcreated: true }
        });

        log.audit("Inventory Adjustment Created", "Adjustment ID: " + adjustmentId);
      }

    } catch (error) {
      log.error({ title: 'ERROR in afterSubmit', details: error });
    }
  }

  return {
    afterSubmit: afterSubmit
  };

});
