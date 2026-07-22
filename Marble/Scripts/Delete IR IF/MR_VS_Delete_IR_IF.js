/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(['N/search', 'N/record', 'N/log'], function(search, record, log) {
  
    function getInputData() {
        return search.create({
          type: "transaction",
          settings:[{ name: "consolidationtype", value: "ACCTTYPE" }],
          filters: [
            ["type", "anyof", "ItemShip", "ItemRcpt"],
            "AND",
            ["createdfrom.type", "anyof", "TrnfrOrd"],
            "AND",
            ["mainline", "is", "T"]
          ],
          columns: [
            search.createColumn({ name: "type", sort: search.Sort.ASC, label: "Type" }), // Sort by Type: ItemRcpt (first), ItemShip (second)
            search.createColumn({ name: "internalid", label: "Internal ID" })
          ]
        });
      }
      

  function map(context) {
    try {
      var result = JSON.parse(context.value);
      var recordType = result.values.type.value; // 'ItemShip' or 'ItemRcpt'
      var internalId = result.values.internalid.value;

      var nsRecordType = (recordType === 'ItemShip') ? record.Type.ITEM_FULFILLMENT :
                         (recordType === 'ItemRcpt') ? record.Type.ITEM_RECEIPT : null;

      if (nsRecordType && internalId) {
        record.delete({type: nsRecordType,id: internalId});

        log.audit('Deleted', `Deleted ${nsRecordType} with ID ${internalId}`);
      } else {
        log.error('Unknown Record Type', `Type: ${recordType}, ID: ${internalId}`);
      }

    } catch (e) {
      log.error('Error in map', e);
    }
  }

  return {
    getInputData: getInputData,
    map: map
  };
});
