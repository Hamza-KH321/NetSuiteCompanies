/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search'],
/**
 * @param {record} record
 * @param {search} search
 */
function(record, search) {
   
    /**
     * Marks the beginning of the Map/Reduce process and generates input data.
     *
     * @typedef {Object} ObjectRef
     * @property {number} id - Internal ID of the record instance
     * @property {string} type - Record type id
     *
     * @return {Array|Object|Search|RecordRef} inputSummary
     * @since 2015.1
     */
    function getInputData() {
    	
    	return search.create({
    		   type: "item",
    		   filters:
    		   [
    		      ["transaction.type","anyof","VendBill"]
    		   ],
    		   columns:
    		   [
    		      search.createColumn({
    		         name: "internalid",
    		         summary: "GROUP",
    		         sort: search.Sort.ASC,
    		         label: "Name"
    		      })
    		   ]
    		});

    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {

      try{
    	var itemID = JSON.parse(context.value).values["GROUP(internalid)"].value
    	log.debug("ID Is "+itemID);
    	
    	var itemSearchObj = search.create({
    		   type: "item",
    		   filters:
    		   [
    		      ["internalid","anyof",itemID],"AND",
    		      ["transaction.type","anyof","VendBill"]
    		   ],
    		   columns:
    		   [
    		      search.createColumn({
    		         name: "itemid",
    		         sort: search.Sort.ASC,
    		         label: "Name"
    		      }),
    		      search.createColumn({
    		         name: "mainline",
    		         join: "transaction",
    		         label: "*"
    		      }),
    		      search.createColumn({
    		         name: "internalid",
    		         join: "transaction",
    		         label: "Internal ID"
    		      }),
    		      search.createColumn({
    		         name: "tranid",
    		         join: "transaction",
    		         label: "Document Number"
    		      }),
    		      search.createColumn({
    		         name: "trandate",
    		         join: "transaction",
    		         sort: search.Sort.DESC,
    		         label: "Date"
    		      }),
    		      search.createColumn({name: "type", label: "Type"}),
                      search.createColumn({
         name: "formulatext",
         formula: "{type.id}",
         label: "Formula (Text)"
})
    		   ]
    		}).run().getRange({start:0,end:3});
    	
    	if(itemSearchObj.length < 2)
    		return ;
    
    		var bill = itemSearchObj[1].getValue({
    		         name: "internalid",
    		         join: "transaction"});
    		
    		var type_ = itemSearchObj[1].getValue('formulatext');
		switch(type_)
          {
            case "InvPart" :type_="inventoryitem"; break;
              case "Service": type_="serviceitem";  break;
            default: type_="inventoryitem"
}
    		var x = record.submitFields({type:type_,id:itemID,values:{"custitem_vs_secondbill":bill,"isinactive":false}});
    	
      }
      catch(e)
      {
        log.error("Error map",e.message);
      }

    }

    /**
     * Executes when the reduce entry point is triggered and applies to each group.
     *
     * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
     * @since 2015.1
     */
    function reduce(context) {

    }


    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    function summarize(summary) {

    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
    
});
