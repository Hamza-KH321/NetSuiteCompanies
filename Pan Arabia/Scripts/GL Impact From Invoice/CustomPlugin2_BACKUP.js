/**
 * Module Description
 * 
 * Version    Date            Author           Remarks
 * 1.00       06 Jun 2022     omarm
 *
 */
function customizeGlImpact(transactionRecord, standardLines, customLines, book)
 {
	try{
		nlapiLogExecution("debug",' hi');
		   
		var lineCount = transactionRecord.getLineItemCount('item'); 
	   	nlapiLogExecution("debug",'lineCount', lineCount);

	    for(var i = 1 ; i <= lineCount ; i++)
	    {
	    	 var accs = nlapiLookupField("item", transactionRecord.getLineItemValue('item', 'item', i ), "incomeaccount");
	    	 var rate = transactionRecord.getLineItemValue('item', 'custcol_vsrateafterdiscount', i );
	    	 var rateAftreDiscount = transactionRecord.getLineItemValue('item', 'rate', i );
	     	 var dis = transactionRecord.getLineItemValue('item', 'custcol_vs_discountrate', i );
	     	 var Brand = transactionRecord.getLineItemValue('item', 'class_display', i );
	     	 var classId = transactionRecord.getLineItemValue('item', 'class', i);
	     	 var department = transactionRecord.getFieldValue('csegvs_dep');
	     	 var Location = transactionRecord.getFieldValue('location');
	     	
		     nlapiLogExecution("debug",' entered loop');
		     nlapiLogExecution("debug",' accs',accs);
		     nlapiLogExecution("debug",' rate',rate);
		     nlapiLogExecution("debug",'dis', dis);
		     nlapiLogExecution("debug",'Brand', Brand);
		     nlapiLogExecution("debug",'department', department);
		     nlapiLogExecution("debug",'Location', Location);
		     nlapiLogExecution("debug",'classId', classId);
		     
		     
		     try {
		    	    // Load the record (e.g., a class record)
		    	    var classRecord = nlapiLoadRecord('classification', classId);

		    	    // Get the internal ID of the record
		    	    var internalId = classRecord.getId();

		    	    // Log the internal ID
		    	    nlapiLogExecution('DEBUG', 'Internal ID', internalId);
		    	} catch (e) {
		    	    nlapiLogExecution('ERROR', 'Error Loading Record', e.toString());
		    	}
 
		  
		      
		     if(dis > 0){
			     var newLine1 = customLines.addNewLine();  
               newLine1.setCreditAmount(dis);
			     newLine1.setAccountId(parseInt(accs));
			     newLine1.setMemo("Sales Revenue");  
			   //  newLine1.setClassId(internalId); 
			   //  newLine1.setDepartmentId(Number(department));
			    // newLine1.setLocationId(Number(warehouseLocation));
			     nlapiLogExecution("DEBUG", "Added Credit Line", newLine1);
			     
			     
			     var newLine2 = customLines.addNewLine();
                newLine2.setDebitAmount(dis);
			     newLine2.setAccountId(293);
			     newLine2.setMemo("Discount");
			  //   newLine2.setDepartmentId(Number(department));
			  //   newLine2.setClassId(internalId); 
			   //  newLine2.setLocationId(Number(warehouseLocation));
			     nlapiLogExecution("DEBUG", "Added Debit Line", newLine1);
                 nlapiLogExecution("DEBUG", "Accs", accs+" ");
	      }
	    }

	} catch (e) {
		nlapiLogExecution("debug", e,e);
    }
   
    
 }
