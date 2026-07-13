/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/record', 'N/currentRecord'], function (record, currentRecord) {

  function fieldChanged(context) {
      var currentRecord = context.currentRecord;
      var sublistName = context.sublistId;
      var fieldName = context.fieldId;

      if (sublistName == 'item') {
          log.debug('item', fieldName);
          currentRecord.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'rate',
              value: 0,
              ignoreFieldChange: true
          });

          currentRecord.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'amount',
              value: 0,
              ignoreFieldChange: true
          });
      }
  }

  return {
      fieldChanged: fieldChanged
  };
});
