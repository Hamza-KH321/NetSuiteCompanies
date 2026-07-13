/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */

define(['N/currentRecord', 'N/search', 'N/ui/message'],

  function(currentRecord, search, message) {

    function pageInit(context) {
      var record = context.currentRecord;
  
      record.setValue({fieldId: 'entity', value: 234 });
      record.setValue({fieldId: 'department', value: 9 });
      record.setValue({fieldId: 'memo', value: 'Sales Order typed by user'});
      log.debug("TESTING");
    }

    function saveRecord(context) {
      var record = context.currentRecord;
      var itemCount = record.getLineCount({ sublistId: 'item'});
      alert('The number of lines is ' + itemCount);

      

      var salesorderSearchObj = search.create({
        type: "salesorder",
        filters:
        [
           ["type","anyof","SalesOrd"], 
           "AND", 
           ["mainline","is","T"]
        ],
        columns:
        [
           search.createColumn({name: "entity", label: "Name"})
        ]
     });

     
     var searchResultCount = salesorderSearchObj.runPaged().count;
     log.debug("salesorderSearchObj result count",searchResultCount);
     salesorderSearchObj.run().each(function(result){
        // .run().each has a limit of 4,000 results
        return true;
     });


     var searchResult= salesorderSearchObj.run().getRange({
        start:0,
        end:1000
     });
     
      record.setValue({fieldId: 'custbody_total_orders2', value: searchResultCount  });
      var totalOrders = record.getValue({ fieldId: 'total'});


      if (totalOrders <= 100) {
                message.create({
                    title: 'Error',
                    message: 'You cannot save this sales order because its total is less than 100',
                    type: message.Type.ERROR
                  }).show();
                 // return false;
      } 
      
      return true;
    }

    return {
      pageInit: pageInit,
      saveRecord: saveRecord
    };
  });