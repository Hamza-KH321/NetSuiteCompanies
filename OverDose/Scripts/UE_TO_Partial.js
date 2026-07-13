/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search'],
/**
 * @param {record} record
 * @param {search} search
 */
function(record, search) {
   
    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
     */
    function beforeLoad(scriptContext) {

    	if(scriptContext.type!=='view')
    		return true;
      log.debug('scriptContext.newRecord.id'+scriptContext.newRecord.id)
    try{	
    	var tos = search.create({
    		   type: "transferorder",
    		   filters:
    		   [
    		      ["type","anyof","TrnfrOrd"], 
    		      "AND", 
    		     // ["applyingtransaction.type","anyof","ItemRcpt"], 
                 ["formulatext: CASE WHEN {quantity} > 0 THEN 'T' else 'F' END","is","T"],
    		      "AND", 
    		      ["internalid","anyof",scriptContext.newRecord.id]
    		   ],
    		   columns:
    		   [
    		      search.createColumn({
    		         name: "tranid",
    		         summary: "GROUP",
    		         label: "Document Number"
    		      }),
    		      search.createColumn({
    		         name: "quantity",
    		         summary: "SUM",
    		         label: "Quantity"
    		      }),
    		      search.createColumn({
    		         name: "quantity",
    		         join: "applyingTransaction",
    		         summary: "SUM",
    		         label: "Quantity"
    		      })
    		   ]
    		}).run().getRange({start:0,end:1});

      log.debug('tos length '+tos.length)
        if(tos.length > 0)
    	{
          log.debug('length');
        var received = Number(tos[0].getValue({
    		         name: "quantity",
    		         join: "applyingTransaction",
    		         summary: "SUM"}));
        log.debug('RECEIIIEVED '+received);
        var qty = Number(tos[0].getValue({
	         name: "quantity",
	         summary: "SUM"}));
         log.debug('QTYYYY '+received);
        var status ="";
        log.debug('qty '+qty + ' recevied '+received)
        if(received == 0)
        	status="Pending Receipt";
        
        if(received > 0 && received < qty)
        	status = "Partially Received "+received+"/"+qty;

          else if(received > 0 && received == qty)
        	status = "Received "+received+"/"+qty;

var id = record.submitFields({
    type: record.Type.TRANSFER_ORDER,
    id: scriptContext.newRecord.id,
    values: {
        custbody_vs_to_customstatus: status 
          },
  options: {
        enableSourcing: false,
        ignoreMandatoryFields : true
    }
            });

          
          
    	}
      else
        {
          var id = record.submitFields({
    type: record.Type.TRANSFER_ORDER,
    id: scriptContext.newRecord.id,
    values: {
        custbody_vs_to_customstatus: "Pending Receipt" 
          },
  options: {
        enableSourcing: false,
        ignoreMandatoryFields : true
    }});
        }
    }
      catch(e)
    {
      log.error("ERROR",e.message);
}
    	return true;
    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function beforeSubmit(scriptContext) {

      if(scriptContext.newRecord.id == undefined || scriptContext.newRecord.id == "")
         return true;
    	if(scriptContext.type!=='view')
    		return true;
      log.debug('scriptContext.newRecord.id'+scriptContext.newRecord.id)
    try{	
    	var tos = search.create({
    		   type: "transferorder",
    		   filters:
    		   [
    		      ["type","anyof","TrnfrOrd"], 
    		      "AND", 
    		      ["applyingtransaction.type","anyof","ItemRcpt"], 
    		      "AND", 
    		      ["internalid","anyof",scriptContext.newRecord.id]
    		   ],
    		   columns:
    		   [
    		      search.createColumn({
    		         name: "tranid",
    		         summary: "GROUP",
    		         label: "Document Number"
    		      }),
    		      search.createColumn({
    		         name: "quantity",
    		         summary: "SUM",
    		         label: "Quantity"
    		      }),
    		      search.createColumn({
    		         name: "quantity",
    		         join: "applyingTransaction",
    		         summary: "SUM",
    		         label: "Quantity"
    		      })
    		   ]
    		}).run().getRange({start:0,end:1});

      log.debug('tos length '+tos.length)
        if(tos.length > 0)
    	{
          log.debug('length');
        var received = Number(tos[0].getValue({
    		         name: "quantity",
    		         join: "applyingTransaction",
    		         summary: "SUM"}));
        log.debug('RECEIIIEVED '+received);
        var qty = Number(tos[0].getValue({
	         name: "quantity",
	         summary: "SUM"}));
         log.debug('QTYYYY '+received);
        var status ="";
        log.debug('qty '+qty + ' recevied '+received)
        if(received == 0)
        	status="Pending Receipt";
        
        if(received > 0 )
        	status = "Partially Received "+received+"/"+qty;

var id = record.submitFields({
    type: record.Type.TRANSFER_ORDER,
    id: scriptContext.newRecord.id,
    values: {
        custbody_vs_to_customstatus: status 
          },
  options: {
        enableSourcing: false,
        ignoreMandatoryFields : true
    }
            });

          
          
    	}
      else
        {
          var id = record.submitFields({
    type: record.Type.TRANSFER_ORDER,
    id: scriptContext.newRecord.id,
    values: {
        custbody_vs_to_customstatus: "Pending Receipt" 
          },
  options: {
        enableSourcing: false,
        ignoreMandatoryFields : true
    }});
        }
    }
      catch(e)
    {
      log.error("ERROR",e.message);
}
    	return true;

    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function afterSubmit(scriptContext) {

    }

    return {
        beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
    
});
