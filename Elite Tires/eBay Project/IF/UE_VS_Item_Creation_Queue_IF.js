/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */

define(["N/record", "N/log", "N/format", "N/search"], function (record, log, format, search) {

  function afterSubmit(context) {
    try {
      // Execute only on record creation or edit, ignore other event types
      if (
        context.type !== context.UserEventType.CREATE &&
        context.type !== context.UserEventType.EDIT
      ) {
        return;
      }

      var newRecord = context.newRecord;
      var lineCount = newRecord.getLineCount({ sublistId: "item" });

      // If there are no items in the transaction, log an error and exit
      if (lineCount === 0) {
        log.error("No Items Found", "No items in the fulfillment record.");
        return;
      }

      // Get the current date and time in MM/DD/YYYY hh:mm:ss a format
      var currentDate = new Date();
      var formattedDate = format.format({ value: currentDate, type: format.Type.DATETIME, });

      // Iterate through each line item
      for (var i = 0; i < lineCount; i++) {
        // Retrieve the item ID from the sublist
        var itemId = newRecord.getSublistValue({ sublistId: "item", fieldId: "item", line: i, });

        if (itemId != '12203') {
          return true;
        }

        // Retrieve the quantity for the item
        var quantity = newRecord.getSublistValue({ sublistId: "item", fieldId: "quantity", line: i, });

        // If item ID is missing, log an error and continue to the next line
        if (!itemId) {
          log.error("Missing Item ID", "Could not retrieve Item ID for line " + i);
          continue;
        }

        // Perform a lookup to retrieve eBay configuration and inventory group details
        var itemLookup = search.lookupFields({
          type: search.Type.INVENTORY_ITEM,
          id: itemId,
          columns: ["custitem_vs_ebay_configuration", "custitem_inv_group"],
        });

        var ebayConfig = itemLookup.custitem_vs_ebay_configuration[0].value;
        var invGroup = itemLookup.custitem_inv_group[0].value;

        // Check if the eBay configuration is not empty and the inventory group is 10
        if (!ebayConfig || invGroup != 10) {
          log.audit("Skipping eBay Queue Record Creation", "Conditions not met for Item ID: " + itemId);
          continue;
        }

        // Create a new eBay queue record
        var ebayQueueRecord = record.create({ type: "customrecord_vs_ebay_queue", isDynamic: true, });

        // Set field values in the eBay queue record
        ebayQueueRecord.setValue({ fieldId: "custrecord_vs_item_to_update", value: itemId, });
        ebayQueueRecord.setValue({ fieldId: "custrecord_vs_update_type", value: "Item Availability", });
        ebayQueueRecord.setValue({ fieldId: "custrecord_vs_processed", value: "Processing", });
        ebayQueueRecord.setValue({ fieldId: "custrecord_vs_ebay_configuration_rec", value: 1, }); // Default value assigned
        ebayQueueRecord.setValue({ fieldId: "custrecord_vs_record_id", value: newRecord.id, });
        ebayQueueRecord.setValue({ fieldId: "custrecord_vs_quantity", value: quantity, });

        // Set the formatted date as text in the datetime field
        ebayQueueRecord.setText({ fieldId: "custrecord_vs_datetime", text: formattedDate, });

        // Save the eBay queue record and log the created record ID
        var recordId = ebayQueueRecord.save();
        log.audit(
          "eBay Queue Record Created",
          "Record ID: " + recordId + " for Item ID: " + itemId
        );
      }
    } catch (error) {
      // Log any unexpected errors that occur during execution
      log.error("Error Creating eBay Queue Records", error);
    }
  }

  return {
    afterSubmit: afterSubmit,
  };
});
