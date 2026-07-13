/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(["N/record", "N/log", "N/format", "N/search"], function (record, log, format, search) {

  function afterSubmit(context) {
    try {
      if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
        return;
      }

      var newRecord = context.newRecord;
      var lineCount = newRecord.getLineCount({ sublistId: "item" });

      if (lineCount === 0) {
        log.error("No Items Found", "No items in the fulfillment record.");
        return;
      }

      var currentDate = new Date();
      var formattedDate = format.format({ value: currentDate, type: format.Type.DATETIME, });

      for (var i = 0; i < lineCount; i++) {
        var itemId = newRecord.getSublistValue({ sublistId: "item", fieldId: "item", line: i, });
        var onhand = newRecord.getSublistValue({ sublistId: "item", fieldId: "onhand", line: i, });

        if (!itemId) {
          log.error("Missing Item ID", "Could not retrieve Item ID for line " + i);
          continue;
        }

        var itemLookup = search.lookupFields({ type: search.Type.INVENTORY_ITEM, id: itemId, columns: ["custitem_vs_ebay_configuration", "custitem_inv_group"], });

        var ebayConfig = itemLookup.custitem_vs_ebay_configuration[0].value;
        var invGroup = itemLookup.custitem_inv_group[0].value;

        if (!ebayConfig || invGroup != 10) {
          log.debug("Skipping eBay Queue Record Creation", "Conditions not met for Item ID: " + itemId);
          continue;
        }

        var ebayQueueRecord = record.create({ type: "customrecord_vs_ebay_queue", isDynamic: true, });

        ebayQueueRecord.setValue({ fieldId: "custrecord_vs_item_to_update", value: itemId, });
        ebayQueueRecord.setValue({ fieldId: "custrecord_vs_update_type", value: "Item Availability", });
        ebayQueueRecord.setValue({ fieldId: "custrecord_vs_processed", value: "Processing", });
        ebayQueueRecord.setValue({ fieldId: "custrecord_vs_ebay_configuration_rec", value: 1, });
        ebayQueueRecord.setValue({ fieldId: "custrecord_vs_record_id", value: newRecord.id, });
        ebayQueueRecord.setValue({ fieldId: "custrecord_vs_quantity", value: onhand, });
        ebayQueueRecord.setText({ fieldId: "custrecord_vs_datetime", text: formattedDate, });

        var recordId = ebayQueueRecord.save();
        log.debug("eBay Queue Record Created", "Record ID: " + recordId + " for Item ID: " + itemId);
      }
    } catch (error) {
      log.error("Error Creating eBay Queue Records", error);
    }
  }

  return {
    afterSubmit: afterSubmit,
  };
});
