/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript

 */

define(["N/record", "N/log", "N/format"], function (record, log, format) {

  function afterSubmit(context) {
    try {
      // Execute only on record creation or edit, ignore other event types
      if (context.type !== context.UserEventType.CREATE &&context.type !== context.UserEventType.EDIT) {
        return;
      }

      // Retrieve the new record and get the internal ID of the item
      var newRecord = context.newRecord;
      var itemId = newRecord.id; // Internal ID of the item

      

      // If the item ID is missing, log an error and exit
      if (!itemId) {
        log.error("Missing Item ID","Item Internal ID could not be retrieved.");
        return;
      }

      if (itemId != '12203') {
        log.error('item is not SLNK32PCS1420-H45R ' ,itemId);
        return true;
      }

      // Retrieve eBay configuration and inventory group fields from the record
      var ebayConfig = newRecord.getValue({
        fieldId: "custitem_vs_ebay_configuration",
      });
      var invGroup = newRecord.getValue({ fieldId: "custitem_inv_group" });

      // Check if eBay configuration is not empty and inventory group is 10
      if (!ebayConfig || invGroup != 10) {
        log.audit("Skipping eBay Queue Record Creation", "Conditions not met.");
        return;
      }

      // Get the current date and time formatted as MM/DD/YYYY hh:mm:ss a
      var currentDate = new Date();
      var formattedDate = format.format({value: currentDate,type: format.Type.DATETIME,});

      // Create a new eBay queue record
      var ebayQueueRecord = record.create({type: "customrecord_vs_ebay_queue",isDynamic: true,});

      // Set required field values in the eBay queue record
      ebayQueueRecord.setValue({fieldId: "custrecord_vs_item_to_update",value: itemId,});
      ebayQueueRecord.setValue({fieldId: "custrecord_vs_update_type",value: "Item Creation/Update",});
      ebayQueueRecord.setValue({fieldId: "custrecord_vs_processed",value: "Processing",});
      ebayQueueRecord.setValue({fieldId: "custrecord_vs_ebay_configuration_rec",value: 1,}); // Default value assigned
      
      // Set the formatted date as text in the datetime field
      ebayQueueRecord.setText({fieldId: "custrecord_vs_datetime",text: formattedDate,});

      // Save the eBay queue record and log the created record ID
      var recordId = ebayQueueRecord.save();
      log.audit("eBay Queue Record Created", "Record ID: " + recordId);
      
    } catch (error) {
      // Log any unexpected errors that occur during execution
      log.error("Error Creating eBay Queue Record", error);
    }
  }

  return {
    afterSubmit: afterSubmit,
  };
});
