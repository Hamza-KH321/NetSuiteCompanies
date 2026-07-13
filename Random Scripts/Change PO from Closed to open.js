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
    	
    	return purchaseorderSearchObj = search.create({
         type: "purchaseorder",
         settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
         filters:
         [
            ["type","anyof","PurchOrd"], 
            "AND", 
            ["mainline","is","T"], 
            "AND", 
            ["trandate","within","23/04/2024","30/04/2024"]
         ],
         columns:
         [
            search.createColumn({name: "tranid", label: "Document Number"}),
            search.createColumn({name: "internalid", label: "Internal ID"}),
            search.createColumn({name: "trandate", label: "Date"}),
            search.createColumn({name: "custbody_vs_poexpirydate", label: "PO Expiry Date"})
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
    	
        var ref = JSON.parse(context.value);
        log.debug('ref is '+ref)

        var intid = ref.values["internalid"].value;
    	log.debug('intid '+intid)

    	var rec= record.load({type:'purchaseorder',id:intid,isDynamic:false});

      //  var expiryDate = new Date('30/05/2024'); // Date format: YYYY-MM-DD
      //  rec.setValue({
      //      fieldId: 'custbody_vs_poexpirydate',
      //      value: expiryDate
      //  });
    	
    	
    	var lineCount = rec.getLineCount({sublistId:'item'});
    	
    	for(var i = 0 ; i < lineCount ; i++)
    	{
    		rec.setSublistValue({sublistId:'item',line:i,fieldId:'isclosed',value:false});
    		//rec.commitLine({sublistId:'item'});
    	}
    		
    	rec.save();
      log.debug('Record Saved' , rec);

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
