/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search','N/email'],
/**
 * @param {record} record
 * @param {search} search
 */
function(record, search,email) {
   
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
      
      var createPOBO = scriptContext.newRecord.getValue('custbody_vs_create_po_bo');

      if(!createPOBO)
        return true;

      if(!scriptContext.newRecord.id)
        return true;
      
    	var objRecord = record.copy({
    	    type: record.Type.PURCHASE_ORDER,
    	    id: scriptContext.newRecord.id,
    	    isDynamic: false
    	});
    	
objRecord.setValue({fieldId:'memo',value:'Sub Purchase Order'}); 
objRecord.setValue({fieldId:'custbody_vs_pobo_parentpo',value:scriptContext.newRecord.id});   
objRecord.setValue({fieldId:'custbody_vs_sendtointegration',value:false});    
objRecord.setValue({fieldId:'custbody_vs_create_po_bo',value:false});  
objRecord.setValue({fieldId:'custbody_vs_sub_po',value:""});  
objRecord.setValue({fieldId:'custbody_vs_po_is_sent',value:false});
objRecord.setValue({fieldId:'custbody_vs_po_sendinginformation',value:""});  
      
      var lineCount = objRecord.getLineCount({sublistId:'item'});

      linesToRemove = new Array();
      
      var searchLines = search.create({
   type: "transaction",
   settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
   filters:
   [
      ["internalid","anyof",scriptContext.newRecord.id], 
      "AND", 
      ["taxline","is","F"], 
      "AND", 
      ["mainline","is","F"]
   ],
   columns:
   [
      search.createColumn({name: "item", label: "Item"}),
      search.createColumn({name: "quantity", label: "Quantity"}),
      search.createColumn({name: "shiprecvstatusline", label: "Fulfilled/Received (Line Level)"}),
      search.createColumn({name: "quantityshiprecv", label: "Quantity Fulfilled/Received"}),
      search.createColumn({
         name: "formulanumeric",
         formula: "{quantity} - {quantityshiprecv}",
         label: "Remaining Qty"
      }),
      search.createColumn({name: "rate", label: "Item Rate"}),
      search.createColumn({name: "custcol_vs_bonus_calculated", label: "bonusCalculated"}),
      search.createColumn({name: "line", label: "Line ID"}),
      search.createColumn({name: "lineuniquekey", label: "Line Unique Key"}),
      search.createColumn({name: "memo", label: "Memo"})
   ]
}).run().getRange({start:0,end:1000});
      
    	

      for(var i = 0; i < searchLines.length ;i++)
      {
       var lineNumber = objRecord.findSublistLineWithValue({
          sublistId: 'item',
          fieldId: 'line',
          value: searchLines[i].getValue('line')
        });

        log.debug("The index of "+searchLines[i].getValue('line')+" is "+lineNumber);
        
        var quantity = searchLines[i].getValue('quantity');
        var received = searchLines[i].getValue('quantityshiprecv');
        
      
log.debug("Qty "+quantity+" Received "+received);
        var remaining = Number(quantity) - Number(received);
        if(remaining <= 0)
          linesToRemove.push(lineNumber);
        else
        {
          objRecord.setSublistValue({sublistId:'item',line:lineNumber,fieldId:'quantity',value:remaining});
        }
        log.debug("Remaining is "+remaining);
      }
      log.debug("Lines to remove",linesToRemove)
      linesToRemove = linesToRemove.reverse(); //sort().
      log.debug("Lines to remove sorted",linesToRemove)
      for(var x = 0; x < linesToRemove.length ;x++)
        {
          log.debug("Removing line "+linesToRemove[x])
          objRecord.removeLine({sublistId:'item',line:linesToRemove[x]});
        }
     var newPO =  objRecord.save();

      record.submitFields({type:'purchaseorder',id:scriptContext.newRecord.id,values:{'custbody_vs_sub_po':newPO}});
    }

    return {
        beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
    
});
