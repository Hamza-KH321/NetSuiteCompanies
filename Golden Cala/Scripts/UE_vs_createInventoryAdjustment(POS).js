/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(["N/record", "N/log", "N/search"], function (record, log, search) {
  function afterSubmit(context) {
    var newRecord = context.newRecord;
    var isCheckboxChecked = newRecord.getValue({
      fieldId: "custrecord_vs_createinventoryadjustment",
    });
    var subsidiary = newRecord.getValue({
      fieldId: "custrecord_vs_subsidiary",
    });
    var adjustmentAccount = newRecord.getValue({
      fieldId: "custrecord_vs_adjustmentaccount",
    });
    var customer = newRecord.getValue({
      fieldId: "custrecord_vs_customer_pos",
    });
    var date = newRecord.getValue({ fieldId: "custrecord_vs_date_pos" });
    var approvalStatus = newRecord.getValue({
      fieldId: "custrecord_vs_approvalstatus_pos",
    });
    var recordID = newRecord.id;
    var itemCount = newRecord.getLineCount({
      sublistId: "recmachcustrecord_vs_posparent",
    });

    log.debug({ title: "Subsidiary is:", details: subsidiary });
    log.debug({ title: "Adjustment Account is:", details: adjustmentAccount });
    log.debug({ title: "Customer is:", details: customer });
    log.debug({ title: "Date is:", details: date });
    log.debug({ title: "record ID is:", details: recordID });
    log.debug({ title: "itemCount is:", details: itemCount });
    log.debug({ title: "approvalStatus is:", details: approvalStatus });

    try {
      //if (isCheckboxChecked  && approvalStatus == "2")
      if (isCheckboxChecked) {
        log.debug({ title: "CheckBox Condition", details: isCheckboxChecked });
        // var subsidiary = newRecord.getValue({
        //     fieldId: 'custrecord_vs_subsidiary'
        // });

        // var adjustmentAccount = newRecord.getValue({
        //     fieldId: 'custrecord_field2'
        // });

        // Create new Inventory Adjustment Record
        var inventoryAdjustment = record.create({
          type: record.Type.INVENTORY_ADJUSTMENT,
          isDynamic: true,
        });

        // Adding Inventory Adjustment Body Fields
        inventoryAdjustment.setValue({
          fieldId: "subsidiary",
          value: subsidiary,
        });

        inventoryAdjustment.setValue({
          fieldId: "custbody_vs_source",
          value: "POS",
        });

        inventoryAdjustment.setValue({
          fieldId: "account",
          value: adjustmentAccount,
        });

        inventoryAdjustment.setValue({
          fieldId: "trandate",
          value: date,
        });

        // inventoryAdjustment.setValue({
        //     fieldId: 'customer',
        //     value: customer
        // });

        // Adding Inventory Adjustment Lines

        for (var i = 0; i < itemCount; i++) {
          var itemId = newRecord.getSublistValue({
            sublistId: "recmachcustrecord_vs_posparent",
            fieldId: "custrecord_vs_item",
            line: i,
          });
          var itemDsc = newRecord.getSublistValue({
            sublistId: "recmachcustrecord_vs_posparent",
            fieldId: "custrecord_vs_description",
            line: i,
          });
          var itemQty = newRecord.getSublistValue({
            sublistId: "recmachcustrecord_vs_posparent",
            fieldId: "custrecord_vs_qty",
            line: i,
          });
          var itemLocation = newRecord.getSublistValue({
            sublistId: "recmachcustrecord_vs_posparent",
            fieldId: "custrecord_vs_location",
            line: i,
          });
          var lotQty = newRecord.getSublistValue({
            sublistId: "recmachcustrecord_vs_posparent",
            fieldId: "custrecord_vs_lotqty_pos",
            line: i,
          });
          var batchNumber = newRecord.getSublistValue({
            sublistId: "recmachcustrecord_vs_posparent",
            fieldId: "custrecord_vs_batchnumber_pos",
            line: i,
          });

          // Save Search to get the item Type so the creation of
          // Inventory adjustment will be different base on the Item Type
          var itemSearchObj = search.create({
            type: "item",
            filters:["internalid", "anyof", itemId],
            columns:
            [
               search.createColumn({name: "type", label: "Type"}),
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "salesdescription", label: "Description"}),
               search.createColumn({name: "islotitem", label: "Is Lot Numbered Item"})
            ]
         });

          var itemSearchResult = itemSearchObj
            .run()
            .getRange({ start: 0, end: 1 });
          var itemResult = itemSearchResult;
          var itemType = itemResult[0].getValue({ name: "type" });
          var isLotItem = itemResult[0].getValue({ name: "islotitem" });

          log.debug({ title: "itemId is:", details: itemId });
          log.debug({ title: "itemDsc is:", details: itemDsc });
          log.debug({ title: "itemQty is:", details: itemQty });
          log.debug({ title: "itemLocation is:", details: itemLocation });
          log.debug({ title: "itemType is:", details: itemType });
          log.debug({ title: "isLotItem:", details: isLotItem });
          log.debug({ title: "lotQty is:", details: lotQty });
          log.debug({ title: "BatchNumber is:", details: batchNumber });
          log.debug({ title: "Break", details: "___________________________" });

          inventoryAdjustment.selectNewLine({
            sublistId: "inventory",
          });

          inventoryAdjustment.setCurrentSublistValue({
            sublistId: "inventory",
            fieldId: "item",
            value: itemId,
          });

          inventoryAdjustment.setCurrentSublistValue({
            sublistId: "inventory",
            fieldId: "adjustqtyby",
            value: itemQty,
          });

          inventoryAdjustment.setCurrentSublistValue({
            sublistId: "inventory",
            fieldId: "description",
            value: itemDsc,
          });

          inventoryAdjustment.setCurrentSublistValue({
            sublistId: "inventory",
            fieldId: "location",
            value: itemLocation,
          });

          // Start inventrory Detail line filed
          if (itemType == "InvtPart" && isLotItem == true) {
            var inventoryDetailSubrecord =
              inventoryAdjustment.getCurrentSublistSubrecord({
                sublistId: "inventory",
                fieldId: "inventorydetail",
              });

            inventoryDetailSubrecord.selectNewLine({
              sublistId: "inventoryassignment",
            });
            inventoryDetailSubrecord.setCurrentSublistValue({
              sublistId: "inventoryassignment",
              fieldId: "quantity",
              value: lotQty,
            });
            // Set lotnumber or serialnumber based on your item type
            inventoryDetailSubrecord.setCurrentSublistValue({
              sublistId: "inventoryassignment",
              fieldId: "receiptinventorynumber",
              value: batchNumber,
            });
            inventoryDetailSubrecord.commitLine({
              sublistId: "inventoryassignment",
            });
          }
          //End inventory adjustment 

          inventoryAdjustment.commitLine({
            sublistId: "inventory",
          });
        }

        var adjustmentId = inventoryAdjustment.save();
        log.debug({
          title: "Inventory Adjustment Created",
          details: "Adjustment ID: " + adjustmentId,
        });
      }
    } catch (error) {
      log.error({ title: "ERRORRRR", details: error });
    }
  }
  return {
    afterSubmit: afterSubmit,
  };
});
