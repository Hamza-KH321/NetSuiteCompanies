/**
 * Copyright (c) 1998-2018 NetSuite, Inc.
 * 2955 Campus Drive, Suite 100, San Mateo, CA, USA 94403-2511
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * NetSuite, Inc. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with NetSuite.
 * 
 * Module Description
 * 
 * Version    Date						Author           				Remarks
 * 1.00       19/10/2021			samir bastia
 *
 *Functionality: It will send transfer order to 3PL
 * 
 */
/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
 define(['N/record', 'N/search', 'N/file','N/render' , 'N/https'],
 /**
  * @param {record} record
  * @param {search} search
  * @param {file} file
  * @param {render} render
  * @param {https} https
  * 
  */

 
 function(record, search, file,render,https) {
    
    var ib_shipment_file_path = "SuiteScripts/VC XML Profiles/VC_XML_IB_SHIPMENT.xml";
    var responseJSON = {
        hdr_group_nbr :"",
        shipment_nbr: "",
        facility_code:"",
        company_code:"",
        trailer_nbr:"",
        action_code:"",
        shipment_type:"",
        shipped_date:"",
        itemdetails : ""
    };

    var itemdetails = {
        hdr_group_nbr :"",
        shipment_nbr: "",
        facility_code:"",
        company_code:"",
        seq_nbr:"",
        item_part_a:"",
        shipped_qty:"",
        putaway_type:"",
        expiry_date:"",
        batch_nbr:"",
        cust_field_1:"",
        cust_field_3:"",
        lpn_lock_code:"",
        uom:"",

    };

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
        try{
            var recObjOrg = scriptContext.newRecord;
            var formId = recObjOrg.getValue('customform');
          
          

            log.debug("Form id "+formId);
            var fldOwner = scriptContext.form.addField({
            id : 'custpage_text',
            type : serverWidget.FieldType.TEXT,
            label : 'Text'
            });

            fldOwner.defaultValue = "Example";
        
            log.debug("Dummy field created");
            
            var addedSublist = scriptContext.form.getSublist({
            id : 'item',
            });
            
            log.debug('Item Sublist'+addedSublist);
            
            
            var itemcolumn = addedSublist.addField({
            id:'custpage_alloweditem' ,
            type: serverWidget.FieldType.SELECT,
            label: 'Batch Owner'
    
    });

        }catch(e){
            log.debug("Error "+e);
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
        
        var recObjOrg = scriptContext.newRecord;
        
       
       
       
        if(scriptContext.type == scriptContext.UserEventType.EDIT || scriptContext.type == scriptContext.UserEventType.CREATE){

                      if(recObjOrg.getText('orderstatus')=='Pending Approval')
                      //if(recObjOrg.getValue('orderstatus')=='A')
              {
                log.debug('Pending Approval RMA...Returning');
                return;
              }
          
          
            try{

                var objRMA = record.load({
                    type: record.Type.RETURN_AUTHORIZATION,
                    id: recObjOrg.id
                })
                var responseJSON = generateJSONProfile(objRMA);
                var xmlProfile = generateXMLProfile(responseJSON);
                log.debug("ASN XML PROFILE ",xmlProfile);
                var headerObj = {
                    "Content-Type": "text/plain",
                    "Accept":"*/*"
                };
                var response = https.post({
                    url: "https://soa12ctest.tamergroup.com/soa-infra/resources/vitacare/InboundMessageDispatcher!1.0/RestService/incomingPayload",
                    body: xmlProfile,
                    headers: headerObj
                });
                var myresponse_body = response.body; // see https.ClientResponse.body
                var myresponse_code = response.code; // see https.ClientResponse.code
                var myresponse_headers = response.headers; // see https.Clientresponse.headers
                log.debug("response ",'myresponse_body '+myresponse_body+": myresponse_code "+myresponse_code+" : myresponse_headers "+myresponse_headers);
                if(myresponse_code!=200){
                    objRMA.setValue("custbody_ns_vc_trans_error_interfacing",true)
                    objRMA.setValue('custbody_ns_vc_trans_error_details',"Error in sending data: "+"myresponse_headers "+ myresponse_headers+" myresponse_body "+myresponse_body)
                }else{
                    objRMA.setValue("custbody_ns_vc_trans_error_interfacing",false)
                    objRMA.setValue('custbody_ns_vc_trans_error_details',"")
                    
                }
                objRMA.save();
            }catch(e){
                objRMA.setValue("custbody_ns_vc_trans_error_interfacing",true)
                objRMA.setValue("custbody_ns_vc_trans_error_details","Internal Error : "+e.toString());
                objRMA.save();
            }
        }

     }
     function generateJSONProfile(objRMA){
        responseJSON.hdr_group_nbr = objRMA.id;
        responseJSON.shipment_nbr = objRMA.getValue('tranid');
        var locationid = objRMA.getValue('location');
        var facilityCode = search.lookupFields({
            type: search.Type.LOCATION,
            id: locationid,
            columns: ["custrecord_5826_loc_branch_id"]
        });
      //log.debug("Branch ID "+JSON.stringify(facilityCode));
        responseJSON.facility_code = facilityCode.custrecord_5826_loc_branch_id;
        responseJSON.company_code = "VITACARE";
        responseJSON.trailer_nbr = "";
        responseJSON.shipment_type = "RMA";
        responseJSON.vendor_info = objRMA.getText('entity');
        responseJSON.shipped_date = objRMA.getValue('trandate');
        responseJSON.cust_field_1 = objRMA.id;
        
        
        var lineCount = objRMA.getLineCount({
            sublistId: 'item'
        });

        var k = 0;
        var finalItemResp = "[";
        for (var i=0; i<lineCount; i++){

            var seqNumber = objRMA.getSublistValue({
                sublistId: 'item',
                fieldId: 'lineuniquekey',
                line: i
            });
            var productionDate = objRMA.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_ns_vc_asn_prod_date',
                line: i
            });
            
            var item = objRMA.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            });

            var itemText = objRMA.getSublistText({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            });
            var pointernalID = "";
            
            /*objRMA.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_ns_vc_asn_po_number',
                line: i
            });
            */

    	var objInvDetailRecord = objRMA.getSublistSubrecord({
                sublistId: 'item',
                fieldId: 'inventorydetail',
                line: i
            });



        // log.debug("objInvDetailRecord",JSON.stringify(objInvDetailRecord));
         var lineSubrecordCount = objInvDetailRecord.getLineCount('inventoryassignment');
  		    for (j = 0; j < lineSubrecordCount; j++) {

                var intSerialNumber = objInvDetailRecord.getSublistValue('inventoryassignment', 'receiptinventorynumber', j);
                var quantity = objInvDetailRecord.getSublistValue('inventoryassignment', 'quantity', j);
                var expiryDate = objInvDetailRecord.getSublistValue('inventoryassignment', 'expirationdate', j);
                var inventorystatus = objInvDetailRecord.getSublistValue('inventoryassignment', 'inventorystatus', j);
                
                //only good or Quarrantine status is applicable here
                if(inventorystatus == 1){
                    inventorystatus = "Good"
                }else{
                    inventorystatus = "QA"
                }

                itemdetails.seq_nbr = seqNumber;
                itemdetails.item_part_a = itemText;
                itemdetails.item_alternate_code = item;
                itemdetails.batch_nbr = intSerialNumber;
                itemdetails.shipped_qty = quantity;
                itemdetails.putaway_type = "";
                itemdetails.expiry_date = expiryDate;
                itemdetails.cust_field_1 = pointernalID;
                itemdetails.cust_field_3 = productionDate;
                itemdetails.lpn_lock_code = inventorystatus;
                itemdetails.uom = "Piece";
                
                finalItemResp+=JSON.stringify(itemdetails)+",";
            }
            if(lineSubrecordCount <= 0 || lineSubrecordCount == null){
                log.debug("Entered non - inv details");
                var quantity = objRMA.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                });

                itemdetails.seq_nbr = seqNumber;
                itemdetails.item_part_a = itemText;
                itemdetails.item_alternate_code = item;
                itemdetails.batch_nbr = "";
                itemdetails.shipped_qty = quantity;
                itemdetails.putaway_type = "";
                itemdetails.expiry_date = "";
                itemdetails.cust_field_1 = pointernalID;
                itemdetails.cust_field_3 = productionDate;
                itemdetails.lpn_lock_code = "";
                itemdetails.uom = "Piece";
                
                finalItemResp+=JSON.stringify(itemdetails)+",";
            }
        }
        finalItemResp+="]";
        responseJSON.itemdetails = JSON.parse(finalItemResp);
        return responseJSON;
     }
     function generateXMLProfile(responseJSON){
        log.debug("responseJSON",responseJSON);
        var templateFile = file.load({
            id: ib_shipment_file_path
        });
        var xmlString = templateFile.getContents();
        var xmlRenderer = render.create();
        xmlRenderer.templateContent = xmlString;
        //Add the values to the XML Content
        xmlRenderer.addCustomDataSource({ format: render.DataSource.OBJECT, alias: 'responseJSON', data: responseJSON });
        var xmlContent = xmlRenderer.renderAsString();

        return xmlContent;
     }
     return {
        // beforeLoad: beforeLoad,
         //beforeSubmit: beforeSubmit,
         afterSubmit: afterSubmit
     };
     
 });
 