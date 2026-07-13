/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/log'],
  function (record, search, log) {

    function afterSubmit(context) {
      try {

        var newRecord = context.newRecord;

        var subsidiary = newRecord.getValue({ fieldId: "subsidiary" });
        var customer = newRecord.getValue({ fieldId: "entity" });
        var adjustmentAccount = 834;
        var location = newRecord.getValue({ fieldId: "location" });
        var date = newRecord.getValue({ fieldId: "trandate" });
        var recordID = newRecord.id;
        var itemCount = newRecord.getLineCount({ sublistId: "item" });
        var invCreated = newRecord.getValue({ fieldId: "custbody_vs_inventoryadjustmentcreated" });

        log.debug('Header Data', {
          subsidiary: subsidiary,
          customer: customer,
          adjustmentAccount: adjustmentAccount,
          location: location,
          date: date,
          recordID: recordID,
          itemCount: itemCount,
          invCreated: invCreated
        });

        if (!invCreated) {

          var inventoryAdjustment = record.create({ type: record.Type.INVENTORY_ADJUSTMENT, isDynamic: true, });

          inventoryAdjustment.setValue({ fieldId: "subsidiary", value: subsidiary });
          if (customer) {
            inventoryAdjustment.setValue({ fieldId: "customer", value: customer });
          }
          inventoryAdjustment.setValue({ fieldId: "account", value: adjustmentAccount });
          inventoryAdjustment.setValue({ fieldId: "trandate", value: date });
          inventoryAdjustment.setValue({ fieldId: "adjlocation", value: location });

          for (var i = 0; i < itemCount; i++) {
            var itemId = newRecord.getSublistValue({ sublistId: "item", fieldId: "item", line: i });
            var itemQty = newRecord.getSublistValue({ sublistId: "item", fieldId: "quantity", line: i });
            var inventoryDetailSubrecord = newRecord.getSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line: i });
            var inventoryDetailCount = inventoryDetailSubrecord.getLineCount({ sublistId: 'inventoryassignment' });

            inventoryAdjustment.selectNewLine({ sublistId: "inventory" });

            inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "item", value: itemId });
            inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "adjustqtyby", value: -itemQty });
            inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "location", value: location });

            var inventoryDetail = inventoryAdjustment.getCurrentSublistSubrecord({ sublistId: 'inventory', fieldId: 'inventorydetail' });

            for (var j = 0; j < inventoryDetailCount; j++) {
              inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });

              var quantity = inventoryDetailSubrecord.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', line: j });
              var status = inventoryDetailSubrecord.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'status', line: j });
              var issueInventoryNumber = inventoryDetailSubrecord.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', line: j });
              var expirationDate = inventoryDetailSubrecord.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'expirationdate', line: j });

              log.debug('Inventory Details Data:', {
                quantity: quantity,
                issueInventoryNumber: issueInventoryNumber,
                expirationDate: expirationDate
              });

              inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: -quantity });
              inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'status', value: status });
              inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: issueInventoryNumber });
              inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'expirationdate', value: expirationDate });

              inventoryDetail.commitLine({ sublistId: 'inventoryassignment' });
            }

            inventoryAdjustment.commitLine({ sublistId: "inventory" });
          }

          var loadedRecord = record.load({ type: newRecord.type, id: newRecord.id });
          var generatedTranId = loadedRecord.getValue({ fieldId: "tranid" });

          inventoryAdjustment.setValue({ fieldId: "custbody_vs_source", value: "Testers - " + generatedTranId });

          try {
            var adjustmentId = inventoryAdjustment.save();

            if (adjustmentId) {
              log.debug('Inventory Adjustment Created', { adjustmentId: adjustmentId });

              try {
                var loadedRecord = record.load({ type: newRecord.type, id: newRecord.id });
                loadedRecord.setValue({ fieldId: 'custbody_vs_inventoryadjustmentcreated', value: true });
                loadedRecord.save();

              } catch (flagError) {
                log.error('Failed to update source transaction flag', flagError);

                try {
                  var errRecord = record.load({ type: newRecord.type, id: newRecord.id });
                  errRecord.setValue({ fieldId: 'custbody_vs_testers_error', value: JSON.stringify(flagError) });
                  errRecord.save();
                } catch (saveErr) {
                  log.error('Error saving error message to field', saveErr);
                }
              }
            } else {
              log.error('Adjustment save returned null/undefined', { sourceRecord: newRecord.id });
            }
          } catch (adjError) {
            log.error('Failed to create Inventory Adjustment', adjError);

            try {
              var errRecord = record.load({ type: newRecord.type, id: newRecord.id });
              errRecord.setValue({ fieldId: 'custbody_vs_testers_error', value: JSON.stringify(adjError) });
              errRecord.save();
            } catch (saveErr) {
              log.error('Error saving error message to field', saveErr);
            }
          }
        }

      } catch (error) {
        log.error({ title: 'ERROR!!!!', details: error });

        try {
          var errRecord = record.load({ type: context.newRecord.type, id: context.newRecord.id });
          errRecord.setValue({ fieldId: 'custbody_vs_testers_error', value: JSON.stringify(error) });
          errRecord.save();
        } catch (saveErr) {
          log.error('Error saving top-level error message to field', saveErr);
        }
      }
    }

    return {
      afterSubmit: afterSubmit
    };

  });
