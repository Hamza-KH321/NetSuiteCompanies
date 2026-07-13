/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(["N/record", "N/log", "N/format"], function (record, log, format) {

  function afterSubmit(context) {
    try {
      if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
        return;
      }

      var newRecord = context.newRecord;
      var itemId = newRecord.id;

      if (!itemId) {
        log.error("Missing Item ID", "Item Internal ID could not be retrieved.");
        return;
      }

      var ebayConfig = newRecord.getValue({ fieldId: "custitem_vs_ebay_configuration", });
      var invGroup = newRecord.getValue({ fieldId: "custitem_inv_group" });

      if (!ebayConfig || invGroup != 10) {
        log.debug("Skipping eBay Queue Record Creation", "Conditions not met.");
        return;
      }

      var currentDate = new Date();
      var formattedDate = format.format({ value: currentDate, type: format.Type.DATETIME, });
      var ebayQueueRecord = record.create({ type: "customrecord_vs_ebay_queue", isDynamic: true, });

      ebayQueueRecord.setValue({ fieldId: "custrecord_vs_item_to_update", value: itemId, });
      ebayQueueRecord.setValue({ fieldId: "custrecord_vs_update_type", value: "Item Creation/Update", });
      ebayQueueRecord.setValue({ fieldId: "custrecord_vs_processed", value: "Processing", });
      ebayQueueRecord.setValue({ fieldId: "custrecord_vs_ebay_configuration_rec", value: 1, });
      ebayQueueRecord.setText({ fieldId: "custrecord_vs_datetime", text: formattedDate, });

      var recordId = ebayQueueRecord.save();
      log.debug("eBay Queue Record Created", "Record ID: " + recordId);

    } catch (error) {
      log.error("Error Creating eBay Queue Record", error);
    }
  }

  return {
    afterSubmit: afterSubmit,
  };
});
