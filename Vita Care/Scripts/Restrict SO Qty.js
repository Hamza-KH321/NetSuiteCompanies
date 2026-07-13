/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/ui/message'], function(message) {
  

  function validateLine(context) {
    var currentRecord = context.currentRecord;
    var status = currentRecord.getValue({fieldId: 'orderstatus'});
   // log.debug({title: "Status is ", details: status });
    
    if (status === 'B') { 
      var lineCount = currentRecord.getLineCount({
        sublistId: 'item'
      });
      if (lineCount > 0) {
        message.create({
          title: 'Error',
          message: 'you cannot add/Edit items of the approved Sales Orders.',
          type: message.Type.ERROR}).show();
          alert("you cannot add/Edit items of the approved Sales Orders.")
        return false;

      } else {
        return true;
      }

    }

  
  }

  return {
    validateLine: validateLine
  };
});

