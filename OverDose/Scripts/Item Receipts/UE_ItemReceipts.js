/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/log', 'N/record','N/search'],
    /**
 * @param{log} log
 * @param{record} record
 * @param{search} search
 */
    (log, record, search) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

    
    
            var createdfromTO = search.create({
                type: "transaction",
                filters:
                [
                   ["mainline","is","T"], 
                   "AND", 
                   ["createdfrom.type","anyof","TrnfrOrd"], 
                   "AND", 
                   ["internalid","anyof",scriptContext.newRecord.id]
                ],
                columns:[
                
                ]
             }).run().getRange({start:0,end:1});
         
         if(createdfromTO.length < 1)
             return true;
               
         try{	
             var TO = scriptContext.newRecord.getValue('createdfrom');
             var tos = search.create({
                    type: "transferorder",
                    filters:
                    [
                       ["type","anyof","TrnfrOrd"], 
                       "AND", 
                       ["applyingtransaction.type","anyof","ItemRcpt"], 
                       "AND", 
                       ["internalid","anyof",TO], 
                       "AND",
                       ["formulatext: CASE WHEN {quantity} > 0 THEN 'T' else 'F' END","is","T"]
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
             
             if(received > 0)
                 status = "Partially Received "+received+"/"+qty;
     log.debug(status);
     var id = record.submitFields({
         type: record.Type.TRANSFER_ORDER,
         id: TO,
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
         id: TO,
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

        return {afterSubmit}

    });
