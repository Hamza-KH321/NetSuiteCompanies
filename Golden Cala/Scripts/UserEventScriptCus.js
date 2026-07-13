/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/record', 'N/search', 'N/ui/dialog'],

function(currentRecord, record, search, dialog) {
   
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
        	var currentRecord = scriptContext.newRecord;

        	if(!currentRecord.getValue('entity')) 
        		return true;
          
        	log.debug('hello...');
        	
//        	if(!currentRecord.getValue('entity')) 
//        		return true;
        	
        	var customerSearchObj = search.create({
     		   type: "customer",
     		   filters:
     		   [
     		    ["internalid","anyof",currentRecord.getValue('entity')]
     		   ],
     		   columns:
     		   [
     		      search.createColumn({name: "balance", label: "Balance"}),
     		      search.createColumn({name: "creditlimit", label: "Credit Limit"}),
     		      search.createColumn({name: "altname", label: "Name"})
     		   ]
     		});
        	
     		var results = customerSearchObj.run().getRange({start: 0, end: 1000});

          if(results.length < 1)
     		return true;

//          if (results[0].getValue('creditlimit') == '')
//        	  results[0].setValue('creditlimit',0);
          
          log.debug("reached after < 1")
     		
    		var balance = results[0].getValue('balance');
            log.debug('balance', balance);
     		var creditlimit = results[0].getValue('creditlimit');
     		log.debug('creditlimit', creditlimit);
     		var total = currentRecord.getValue('total');
     		log.debug('total', total);
     		
     		
     		
     		 if (results[0].getValue('creditlimit') == '')
     			creditlimit = 0;
     		
            x = creditlimit - balance - total;
     		log.debug('x', x);

     		currentRecord.setValue({
                fieldId: 'custbody_vs_customer_creditlimit',
                value: x
            });
         
     		return true; // Allow saving
          }
          
          catch(e)
          {
            log.error('error',e)
          }
      
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
       // beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        //afterSubmit: afterSubmit
    };
    
});
