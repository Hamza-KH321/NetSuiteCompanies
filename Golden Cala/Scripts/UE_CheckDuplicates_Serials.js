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

      try{
        //checking billing
/*
        var searc = search.create({
   type: "customrecord_vs_itemserials",
   filters:
   [
      ["internalid","anyof",scriptContext.newRecord.id]
   ],
   columns:
   [
      search.createColumn({name: "scriptid", label: "Script ID"}),
      search.createColumn({name: "custrecord_vs_fulfillment", label: "Fulfillment"}),
      search.createColumn({name: "custrecord_vs_serialitem", label: "Item"}),
      search.createColumn({name: "custrecord_vs_lotexpiry", label: "Lot/Expiry"}),
      search.createColumn({name: "custrecord_vs_serialserial", label: "Serial #"}),
      search.createColumn({
         name: "type",
         join: "CUSTRECORD_VS_FULFILLMENT",
         label: "Type"
      }),
      search.createColumn({
         name: "createdfrom",
         join: "CUSTRECORD_VS_FULFILLMENT",
         label: "Created From"
      })
   ]
}).run().getRange({start:0,end:1});
      
      
      var recType = searc[0].getValue({name: "type",join: "CUSTRECORD_VS_FULFILLMENT"});
      log.debug(recType);

      if(recType=="ItemShip")
      {
      var createdFrom = searc[0].getText({name: "createdfrom",join: "CUSTRECORD_VS_FULFILLMENT"});
      log.debug(createdFrom); 

        if(createdFrom.indexOf("Sales Order")!=-1)
        {
          log.debug("This is from sales order");
          intId =  searc[0].getValue({name: "createdfrom",join: "CUSTRECORD_VS_FULFILLMENT"});
          var so = record.load({type:'salesorder',id:intId});
          var status =  so.getValue('status');
          log.debug("The status is "+status);
          if(status.indexOf("Billed")!=-1)
          {
            if(scriptContext.type=="edit" && scriptContext.oldRecord.getValue('custrecord_vs_serialserial')!="")
            throw new Error("This fulfillment has an invoice corresponding to it - لقد تم فوترة هذه الشحنة")
          }
        }
      }
*/

        //end
    	var item = scriptContext.newRecord.getValue('custrecord_vs_fulfillment');
    	var serial = scriptContext.newRecord.getValue('custrecord_vs_serialserial');
      log.debug("record",JSON.stringify(scriptContext.newRecord))

      if(serial=="" || serial == undefined || serial ==" ")
        return true;
      
    	var duplicate = false;
    	log.debug("item "+item);
    	if(scriptContext.newRecord.id == undefined || scriptContext.newRecord.id == "")
    	{
          return true;
    	var customrecord_vs_itemserialsSearchObj = search.create({
    		   type: "customrecord_vs_itemserials",
    		   filters:
    		   [
    		      //["custrecord_vs_fulfillment","anyof",item], 
    		      //"AND", 
    		      ["custrecord_vs_serialserial","is",serial]
    		   ],
    		   columns:
    		   [
    		      search.createColumn({name: "scriptid", label: "Script ID"}),
    		      search.createColumn({name: "custrecord_vs_serialitem", label: "Item"}),
    		      search.createColumn({name: "custrecord_vs_lotexpiry", label: "Lot/Expiry"}),
    		      search.createColumn({name: "custrecord_vs_serialserial", label: "Serial #"})
    		   ]
    		}).run().getRange({start:0,end:1});
    	
    	if(customrecord_vs_itemserialsSearchObj.length > 0)
    		duplicate = true;
    	}
    	else
    	{
        var item = scriptContext.newRecord.getValue('custrecord_vs_serialitem');
    	var serial = scriptContext.newRecord.getValue('custrecord_vs_serialserial');
          
        	var customrecord_vs_itemserialsSearchObj = search.create({
     		   type: "customrecord_vs_itemserials",
     		   filters:
     		   [
    		      ["internalid","noneof",scriptContext.newRecord.id], 
    		      "AND", 
    		      ["custrecord_vs_serialserial","is",serial]
     		   ],
     		   columns:
     		   [
     		      search.createColumn({name: "scriptid", label: "Script ID"}),
     		      search.createColumn({name: "custrecord_vs_serialitem", label: "Item"}),
     		      search.createColumn({name: "custrecord_vs_lotexpiry", label: "Lot/Expiry"}),
     		      search.createColumn({name: "custrecord_vs_serialserial", label: "Serial #"})
     		   ]
     		}).run().getRange({start:0,end:1});
        	
        	if(customrecord_vs_itemserialsSearchObj.length > 0)
            {
             var fulfillment = search.lookupFields({type:'customrecord_vs_itemserials',id:customrecord_vs_itemserialsSearchObj[0].id,columns:['custrecord_vs_fulfillment']}).custrecord_vs_fulfillment[0].value;

              var thisFulfillment = search.lookupFields({type:'customrecord_vs_itemserials',id:scriptContext.newRecord.id,columns:['custrecord_vs_fulfillment']}).custrecord_vs_fulfillment[0].value;

              log.debug("This fulf "+thisFulfillment+" Fulfimsearch "+fulfillment)

              if(fulfillment==thisFulfillment)
        		duplicate = true;
            }
          
    	}
      }
      catch(e)
      {
        log.error("Error",JSON.stringify(e));
      }
    	if(duplicate)
    		throw new Error("Duplicate Serial, please check - الرقم التسلسلي متكرر!");


      

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
