/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/log'], function(log) {
  
    function pageInit(context) {
      var currentRecordObj = context.currentRecord;
      var sublistId = context.sublistId;
      var fieldId = context.fieldId;
  
      // Check if the sublist is the 'item' sublist and the field changed is 'item'
      if (sublistId === 'item' && fieldId === 'item') {
        var lineCount = currentRecordObj.getLineCount({ sublistId: sublistId });
  
        // Loop through each line in the sublist
        for (var line = 0; line < lineCount; line++) {
          // Retrieve the location value for the current line
          var location = currentRecordObj.getSublistValue({
            sublistId: sublistId,
            fieldId: 'location',
            line: line
          });
  
          // Print the location value to the console
          log.debug('Location for line ' + (line + 1), location);
        }
      }
    }
  
    return {
        pageInit: pageInit
    };
  });
  