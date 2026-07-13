/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search','N/url','N/https','N/currentRecord'],
/**
 * @param {record} record
 * @param {search} search
 */
function(record, search, url,https, currentRecord) {
    
    /**
     * Function to be executed after page is initialized.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
     *
     * @since 2015.2
     */

    function pageInit(scriptContext) {

    }

    /**
     * Function to be executed when field is changed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
     * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
     *
     * @since 2015.2
     */
    function fieldChanged(scriptContext) {

    }

    /**
     * Function to be executed when field is slaved.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     *
     * @since 2015.2
     */
    function postSourcing(scriptContext) {

    }

    /**
     * Function to be executed after sublist is inserted, removed, or edited.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @since 2015.2
     */
    function sublistChanged(scriptContext) {

    }

    /**
     * Function to be executed after line is selected.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @since 2015.2
     */
    function lineInit(scriptContext) {

    }

    /**
     * Validation function to be executed when field is changed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
     * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
     *
     * @returns {boolean} Return true if field is valid
     *
     * @since 2015.2
     */
    function validateField(scriptContext) {

    }

    /**
     * Validation function to be executed when sublist line is committed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @returns {boolean} Return true if sublist line is valid
     *
     * @since 2015.2
     */
    function validateLine(scriptContext) {

    }

    /**
     * Validation function to be executed when sublist line is inserted.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @returns {boolean} Return true if sublist line is valid
     *
     * @since 2015.2
     */
    function validateInsert(scriptContext) {

    }

    /**
     * Validation function to be executed when record is deleted.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @returns {boolean} Return true if sublist line is valid
     *
     * @since 2015.2
     */
    function validateDelete(scriptContext) {

    }

    /**
     * Validation function to be executed when record is saved.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @returns {boolean} Return true if record is valid
     *
     * @since 2015.2
     */
    function BO_Create(scriptContext) {

  
    	var rec_id = currentRecord.get().id;
      
    	var rec = record.load({type:'salesorder',id:rec_id});
      
    	var lineCount = rec.getLineCount({sublistId:'item'});   
    	var wh = rec.getValue({fieldId:'location'});	
     	var items = new Array();
      	
  	    
    	for(var i = 0 ; i < lineCount ; i++)
        {
         var item = new Object();
          
          
         if( rec.getSublistValue({
          sublistId:'item',
          line:i,
          fieldId:'custcol_vs_createso'
        }) == false)
           {
             item.item = 0;
             item.backOrdered = 0;
             item.qty = 0 ;
             //items.push(item);
             continue;
           }
       
         item.item = rec.getSublistValue({
          sublistId:'item',
          line:i,
          fieldId:'item'
        });
          item.rate = rec.getSublistValue({
          sublistId:'item',
          line:i,
          fieldId:'rate'
        });
          
        item.taxcode = rec.getSublistValue({
          sublistId:'item',
          line:i,
          fieldId:'taxcode'
        });
       
   item.backOrdered = rec.getSublistValue({
          sublistId:'item',
          line:i,
          fieldId:'quantitybackordered'
   });
       

   var qtyAvailable = search.create({
   type: "item",
   filters:
   [
      ["internalid","is",item.item], 
      "AND", 
      ["inventorylocation","anyof",wh]
   ],
   columns:
   [
      search.createColumn({
         name: "inventorylocation",
         summary: "GROUP",
         label: "Inventory Warehouse"
      }),
      search.createColumn({
         name: "quantityavailable",
         join: "inventoryNumber",
         summary: "SUM",
         label: "Available"
      })
   ]
}).run().getRange({start:0,end:1})[0].getValue({
         name: "quantityavailable",
         join: "inventoryNumber",
         summary: "SUM",
      });
         // alert(qtyAvailable)
  //  if(item.qtyAvailable ==undefined)
    //  item.qtyAvailable = 0;
          
         if(Number(item.backOrdered)>Number(qtyAvailable))
         item.qty = qtyAvailable;
          else
         item.qty = item.backOrdered; 
     

           items.push(item); 
         
        }//for
      
      var raw = JSON.stringify({
	"body":{
  "action": "CREATE",
  "fields": {
    "customer": rec.getValue('entity'),
    "location": rec.getValue('location'),
    "custbody_vc_pmt_meth" : rec.getValue('custbody_vc_pmt_meth'),
    "otherrefnum" : rec.getValue('otherrefnum'),
    "date": "1/1/2022",
    "parent": rec.id,
    "items": items
  }}
});
      log.debug('raw',raw);
      
      
      try{
                var suiteletURL = url.resolveScript({
                    scriptId: 'customscript_vs_rest_create_bo',
                    deploymentId: 'customdeploy_vs_rest_create_bo',
                    returnExternalUrl: false,
                    params: {
                       
                    },
                });
      }
      catch(e)
        {
          alert(e)
        }
      var myHeaders = new Headers();
      myHeaders.append("User-Agent", "Mozilla/5.0");
      myHeaders.append("token", "123");
      myHeaders.append("Content-Type", "application/json");

      try{
      //new
     // rec.setValue({fieldId:'custbody_vs_is_parent_order',value:true});
     // rec.save();
        
      //end new 
      var resp = https.post({url: suiteletURL, headers: myHeaders,body:raw});
      var id = JSON.parse(resp.body).id;
      var so_url =url.resolveRecord({
    recordType: record.Type.SALES_ORDER,
    recordId: id,
    isEditMode: true
});
      window.open(so_url)
      }
      catch(e)
        {
          alert(e)
        }
      
      return true;
    }
  
    function BO_Create_All(scriptContext) {

try{
      var rec_id = currentRecord.get().id;
      
    	var rec = record.load({type:'salesorder',id:rec_id});
      
    	var lineCount = rec.getLineCount({sublistId:'item'});   
    	var wh = rec.getValue({fieldId:'location'});	
     	var items = new Array();
      	
  	    
    	for(var i = 0 ; i < lineCount ; i++)
        {
         var item = new Object();
          
          
 /*        if( rec.getSublistValue({
          sublistId:'item',
          line:i,
          fieldId:'custcol_vs_createso'
        }) == false)
           {
             item.item = 0;
             item.backOrdered = 0;
             item.qty = 0 ;
             //items.push(item);
             continue;
           }
    */   
         item.item = rec.getSublistValue({
          sublistId:'item',
          line:i,
          fieldId:'item'
        });
          item.rate = rec.getSublistValue({
          sublistId:'item',
          line:i,
          fieldId:'rate'
        });
          
        item.taxcode = rec.getSublistValue({
          sublistId:'item',
          line:i,
          fieldId:'taxcode'
        });
       
   item.backOrdered = rec.getSublistValue({
          sublistId:'item',
          line:i,
          fieldId:'quantitybackordered'
   });
       
   if(Number(item.backOrdered)==0)
     continue;
          
   var qtyAvailable = search.create({
   type: "item",
   filters:
   [
      ["internalid","is",item.item], 
      "AND", 
      ["inventorylocation","anyof",wh]
   ],
   columns:
   [
      search.createColumn({
         name: "inventorylocation",
         summary: "GROUP",
         label: "Inventory Warehouse"
      }),
      search.createColumn({
         name: "quantityavailable",
         join: "inventoryNumber",
         summary: "SUM",
         label: "Available"
      })
   ]
}).run().getRange({start:0,end:1})[0].getValue({
         name: "quantityavailable",
         join: "inventoryNumber",
         summary: "SUM",
      });
         // alert(qtyAvailable)
  //  if(item.qtyAvailable ==undefined)
    //  item.qtyAvailable = 0;
          
        if(Number(item.backOrdered) <= 0 || Number(qtyAvailable) <= 0)
          continue;
          
         if(Number(item.backOrdered)>Number(qtyAvailable))
         item.qty = qtyAvailable;
          else
         item.qty = item.backOrdered; 
     

           items.push(item); 
         
        }//for
      
      var raw = JSON.stringify({
	"body":{
  "action": "CREATE",
  "fields": {
    "customer": rec.getValue('entity'),
    "location": rec.getValue('location'),
    "custbody_vc_pmt_meth" : rec.getValue('custbody_vc_pmt_meth'),
    "otherrefnum" : rec.getValue('otherrefnum'),
    "date": "1/1/2022",
    "parent": rec.id,
    "items": items
  }}
});
      alert(JSON.stringify(raw));
      alert(raw)
}catch(e)
{
  alert(e)
}
      
      try{
                var suiteletURL = url.resolveScript({
                    scriptId: 'customscript_vs_rest_create_bo',
                    deploymentId: 'customdeploy_vs_rest_create_bo',
                    returnExternalUrl: false,
                    params: {
                       
                    },
                });
      }
      catch(e)
        {
          alert(e)
        }
      var myHeaders = new Headers();
      myHeaders.append("User-Agent", "Mozilla/5.0");
      myHeaders.append("token", "123");
      myHeaders.append("Content-Type", "application/json");

      try{
      //new
     // rec.setValue({fieldId:'custbody_vs_is_parent_order',value:true});
    //  rec.save();
        
      //end new 
      var resp = https.post({url: suiteletURL, headers: myHeaders,body:raw});
      var id = JSON.parse(resp.body).id;
      var so_url =url.resolveRecord({
    recordType: record.Type.SALES_ORDER,
    recordId: id,
    isEditMode: true
});
      window.open(so_url)
      }
      catch(e)
        {
          alert(e)
        }
      
      return true;
    }
    

    return {
      	pageInit: pageInit,
        BO_Create: BO_Create,
      	BO_Create_All: BO_Create_All
    };
    
});
