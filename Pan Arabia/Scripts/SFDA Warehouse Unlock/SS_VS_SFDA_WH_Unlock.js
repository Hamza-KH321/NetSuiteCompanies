/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/log', 'N/runtime'], function(record, search, log,runtime) {

    function execute(context) {

try {
            var scriptObj = runtime.getCurrentScript();
              
            var rectype = scriptObj.getParameter({name: 'custscript_vs_recordtype2'});
            var recid = scriptObj.getParameter({name: 'custscript_vs_recordid2'});
            
            // Get data from Transaction Record Item Receipts
            var newRecord = record.load({type:rectype,id:recid});
    
                // Retrieve line count
                var lineCount = newRecord.getLineCount({
                    sublistId: 'item'
                });
    
                for (var i = 0; i < lineCount; i++) {
                    // Get location for each line
                    var location = newRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        line: i
                    });

                    log.debug('Location for line ' + i + ' is: ' , location);
    
                    var inventoryDetailSubrecord = newRecord.getSublistSubrecord({
                        sublistId: 'item',
                        fieldId: 'inventorydetail',
                        line: i
                    });

                    // log.debug('inventoryDetailSubrecord for line ' + i + ' is: ' , inventoryDetailSubrecord);

                  var lengthh = inventoryDetailSubrecord.getLineCount({sublistId:'inventoryassignment'});
                  
                        // Set the inventory status in the inventory detail subrecord
                    if (location == "1") {
                      for(var j = 0 ; j < lengthh ;j++)
                        {
                            inventoryDetailSubrecord.setSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'inventorystatus',
                                line: j, 
                                value: 1
                            });
                        }
                    }
                    // log.debug('Inventory Status is: ' , inventoryStatus);
                }
  newRecord.save();
} catch (error) {
    log.error('ERRORRRRR!' , error);
}

    }

    return {
        execute: execute
    };
});
