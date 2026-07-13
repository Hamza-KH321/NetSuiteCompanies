/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search','N/runtime', 'N/email'],
    /**
     * @param {record} record
     * @param {search} search
     */
    function(record, search, runtime, email) {
       
        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(scriptContext) {
    
            try {
        
      var scriptObj = runtime.getCurrentScript();     
      var rectype = scriptObj.getParameter({name: 'custscript_vs_type_foc'});
      var recid = scriptObj.getParameter({name: 'custscript_vs_id_foc'});
    
                // Get data from Transaction Record Gifts (Header Data)
                var newRecord = record.load({type:rectype,id:recid}); //load record 
    
                var internalID = newRecord.getValue({fieldId: "recordid"});
                var date = newRecord.getValue({fieldId: "custrecord_vs_date_foc_new"});
                var customer = newRecord.getValue({fieldId: "custrecord_vs_customer_foc_new"});
                var employee = newRecord.getValue({fieldId: "custrecord_vs_employee_foc_new"});
                var location = newRecord.getValue({fieldId: "custrecord_vs_location_foc_new"});
                var headerNotes = newRecord.getValue({fieldId: "custrecord_vs_notes_foc_new"});
                var IACreated = newRecord.getValue({fieldId: "custrecord_vs_iacreatedsuccessfully_foc"});
                var custForm = newRecord.getText({fieldId: "customform"});
                var itemCount = newRecord.getLineCount({sublistId: "recmachcustrecord_vs_parent_foc_new"});
                var approvalStatus = newRecord.getValue({fieldId: "custrecord_vs_focapprovalstatus_new"});

                log.debug('internalID is:', internalID);
                log.debug('date is:', date);
                log.debug('customer is:', customer);
                log.debug('employee is:', employee);
                log.debug('location is:', location);
                log.debug('headerNotes is:', headerNotes);
                log.debug('IACreated is:', IACreated);
                log.debug('custForm is:', custForm);
                log.debug('itemCount is:', itemCount);
                log.debug('approvalStatus is:', approvalStatus);


                if(approvalStatus == 2 && !IACreated)
                    {
                        newRecord.setValue({fieldId:'custrecord_vs_iacreatedsuccessfully_foc',value:true});

                        var inventoryAdjustment = record.create({
                            type: record.Type.INVENTORY_ADJUSTMENT,
                            isDynamic: true,
                          });

                          inventoryAdjustment.setValue({fieldId: "subsidiary", value: 2,});
                          inventoryAdjustment.setValue({fieldId: "custbody_vs_source", value: 'FOC - ' + internalID});
                          inventoryAdjustment.setValue({fieldId: "memo", value: headerNotes});
                          inventoryAdjustment.setValue({fieldId: "account", value: '816'});


                        inventoryAdjustment.setValue({fieldId: "trandate",value: date});
                        inventoryAdjustment.setValue({fieldId: "adjlocation",value: location});

                        // Lines Data
                        for (var i = 0; i < itemCount; i++) {
                            var itemId = newRecord.getSublistValue({sublistId: "recmachcustrecord_vs_parent_foc_new",fieldId: "custrecord_vs_item_foc_new",line: i,});
                            var qty = newRecord.getSublistValue({sublistId: "recmachcustrecord_vs_parent_foc_new",fieldId: "custrecord_vs_quantity_foc_new",line: i,});
                            var memoLine = newRecord.getSublistValue({sublistId: "recmachcustrecord_vs_parent_foc_new",fieldId: "custrecord_vs_memoline_foc_new",line: i,});

                            var itemType = search.lookupFields({type: search.Type.ITEM,id: itemId,columns: ['type']});
                            var itemTypeValue = itemType.type[0].value;

                            log.debug('Line'+ i +', itemId is:', itemId);
                            log.debug('Line'+ i +', qty is:', qty);
                            log.debug('Line'+ i +', memoLine is:', memoLine);
                            log.debug('Line'+ i +', item Type is:', itemTypeValue);

                            inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "item", value: itemId });
                            inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "location", value: location });
                            inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "adjustqtyby", value: -qty });
                            inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "memo", value: memoLine });

                        // Adding Inventory Details for Lot Numbered Items
                        if (itemTypeValue == 'lotnumberedinventoryitem' || itemTypeValue == 'InvtPart') {
                            var inventoryDetail = inventoryAdjustment.getCurrentSublistSubrecord({
                                sublistId: 'inventory',
                                fieldId: 'inventorydetail'
                            });
                            log.debug('Lot Numbered item', itemTypeValue);
                        
                            var inventorynumberSearchObj = search.create({
                                type: "inventorynumber",
                                filters: [
                                    ["quantityavailable", "notequalto", "0"],
                                    "AND",
                                    ["item", "anyof", itemId],
                                    "AND",
                                    ["location", "anyof", location]
                                ],
                                columns: [
                                    search.createColumn({ name: "inventorynumber", label: "Number" }), // Serial Lot Number 
                                    search.createColumn({ name: "quantityavailable", label: "Available" }), // Qty 
                                    search.createColumn({ name: "datecreated", label: "Date Created" }),
                                    search.createColumn({ name: "internalid", label: "Internal ID" })
                                ]
                            });
                        
                            var searchResults = inventorynumberSearchObj.run().getRange({ start: 0, end: 1000 });
                            var totalQuantityNeeded = qty;
                            var totalQuantityAssigned = 0;
                        
                            for (var i = 0; i < searchResults.length && totalQuantityAssigned < totalQuantityNeeded; i++) {
                                var result = searchResults[i];
                                var available = parseFloat(result.getValue({ name: "quantityavailable" }));
                                var lotNumberID = result.getValue({ name: "internalid" });
                            
                                if (available <= 0) continue;
                            
                                var quantityToAssign = Math.min(totalQuantityNeeded - totalQuantityAssigned, available);
                            
                                log.debug('Available Qty:', available);
                                log.debug('Quantity to Assign:', quantityToAssign);
                                log.debug('Lot Number (Internal ID):', lotNumberID);
                            
                                inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });
                            
                                inventoryDetail.setCurrentSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'quantity',
                                    value: -quantityToAssign // Make quantity negative to Issue Items
                                });
                            
                                inventoryDetail.setCurrentSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'issueinventorynumber',
                                    value: lotNumberID
                                });
                            
                                inventoryDetail.commitLine({ sublistId: 'inventoryassignment' });
                            
                                totalQuantityAssigned += quantityToAssign;
                            }
                        
                            if (totalQuantityAssigned < totalQuantityNeeded) {
                                log.error('Insufficient quantity available for item:', itemId);

                                var employeeId = 1925;
                                var employeeSearch = search.create({
                                    type: search.Type.EMPLOYEE,
                                    filters: [
                                        ['internalid', 'anyof', employeeId]
                                    ],
                                    columns: [
                                        'email',
                                        'entityid'
                                    ]
                                });
                        
                                var employeeSearchResults = employeeSearch.run().getRange({ start: 0, end: 1 });
                                var employeeEmail = employeeSearchResults[0].getValue('email');
                                var employeeName = employeeSearchResults[0].getValue('entityid');
                        
                                var emailSubject = 'Insufficient Quantity for Item';
                                var emailBody = 'Dear ' + employeeName + ',\n\n';
                                emailBody += 'There is insufficient quantity available for the following item:\n';
                                emailBody += '- Item ID: ' + itemId + '\n';
                                emailBody += '- Gifts ID: ' + internalID + '\n';
                                emailBody += 'Please note that this Gift transaction did not generate Inventory Adjustment.\n\n';
                                emailBody += 'Please take necessary action.\n\n';
                                emailBody += 'Regards,\nYour NetSuite System';
                
                                email.send({
                                    author: runtime.getCurrentUser().id,
                                    recipients: employeeEmail,
                                    subject: emailSubject,
                                    body: emailBody
                                });
                            }
                        }

                            inventoryAdjustment.commitLine({ sublistId: "inventory" });
                        }

                        var adjustmentId = inventoryAdjustment.save();
                        newRecord.save();
                        log.debug({title: "Inventory Adjustment Created" , details: "Adjustment ID: " + adjustmentId});
                    }
    
        } catch (error) {
          log.error({title: 'ERROR!!!!' , details: error});   
        }
    
        }
    
        return {
            execute: execute
        };
        
    });
    