/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log', 'N/search'],

    function(record, log, search) {

        function afterSubmit(context) {
            var newRecord = context.newRecord;
            var isCheckboxChecked = newRecord.getValue({fieldId: 'custrecord_vs_cia_foc'});
            var subsidiary = newRecord.getValue({fieldId: 'custrecord_vs_foc_subsidiary'});
            var adjustmentAccount = newRecord.getValue({fieldId: 'custrecord_vs_adjustmentaccount_foc'});
            var customer = newRecord.getValue({fieldId: 'custrecord_vs_customer_foc'});
            var date = newRecord.getValue({fieldId: 'custrecord_vs_datee_foc'});
            var approvalStatus = newRecord.getValue({fieldId: 'custrecord_vs_approvalstatus_foc'});
            var itemCount = newRecord.getLineCount({sublistId: 'recmachcustrecord_vs_parent_foc'});
            var recordID = newRecord.id;

            log.debug({title: 'Subsidiary is:', details: subsidiary});
            log.debug({title: 'Adjustment Account is:', details: adjustmentAccount});
            log.debug({title: 'Customer is:', details: customer});
            log.debug({title: 'Date is:', details: date});
            log.debug({title: 'record ID is:', details: recordID});
            log.debug({title: 'itemCount is:', details: itemCount});
            log.debug({title: 'approvalStatus is:', details: approvalStatus});

            try {
                if (isCheckboxChecked && approvalStatus == '2') {

                log.debug({title: 'CheckBox Condition', details: isCheckboxChecked});
                // var subsidiary = newRecord.getValue({
                //     fieldId: 'custrecord_vs_subsidiary'
                // });

                // var adjustmentAccount = newRecord.getValue({
                //     fieldId: 'custrecord_field2'
                // });

                // Create new Inventory Adjustment Record
                var inventoryAdjustment = record.create({
                    type: record.Type.INVENTORY_ADJUSTMENT,
                    isDynamic: true
                });

                // Adding Inventory Adjustment Body Fields
                inventoryAdjustment.setValue({
                    fieldId: 'subsidiary',
                    value: subsidiary
                });

                inventoryAdjustment.setValue({
                    fieldId: 'custbody_vs_source',
                    value: 'FOC'
                });

                inventoryAdjustment.setValue({
                    fieldId: 'account',
                    value: adjustmentAccount
                });

                inventoryAdjustment.setValue({
                    fieldId: 'trandate',
                    value: date
                });

                // inventoryAdjustment.setValue({
                //     fieldId: 'customer',
                //     value: customer
                // });

                // Adding Inventory Adjustment Lines

                for (var i = 0; i < itemCount; i++) {
                    var itemId = newRecord.getSublistValue({
                        sublistId: 'recmachcustrecord_vs_parent_foc',
                        fieldId: 'custrecord_vs_items_foc',
                        line: i
                    });
                    var itemDsc = newRecord.getSublistValue({
                        sublistId: 'recmachcustrecord_vs_parent_foc',
                        fieldId: 'custrecord_vs_description_foc',
                        line: i
                    });
                    var itemQty = newRecord.getSublistValue({
                        sublistId: 'recmachcustrecord_vs_parent_foc',
                        fieldId: 'custrecord_vs_qty_foc',
                        line: i
                    });
                    var itemLocation = newRecord.getSublistValue({
                        sublistId: 'recmachcustrecord_vs_parent_foc',
                        fieldId: 'custrecord_vs_location_foc',
                        line: i
                    });
    
                    log.debug({title: 'itemId is:', details: itemId});
                    log.debug({title: 'itemDsc is:', details: itemDsc});
                    log.debug({title: 'itemQty is:', details: itemQty});
                    log.debug({title: 'itemLocation is:', details: itemLocation});

                    inventoryAdjustment.selectNewLine({
                        sublistId: 'inventory'
                    });
    
                    inventoryAdjustment.setCurrentSublistValue({
                        sublistId: 'inventory',
                        fieldId: 'item',
                        value: itemId
                    });
    
                    inventoryAdjustment.setCurrentSublistValue({
                        sublistId: 'inventory',
                        fieldId: 'adjustqtyby',
                        value: itemQty
                    });
    
                    inventoryAdjustment.setCurrentSublistValue({
                        sublistId: 'inventory',
                        fieldId: 'description',
                        value: itemDsc
                    });
    
                    inventoryAdjustment.setCurrentSublistValue({
                        sublistId: 'inventory',
                        fieldId: 'location',
                        value: itemLocation
                    });
    
                    inventoryAdjustment.commitLine({
                        sublistId: 'inventory'
                    });
                }
                
                var adjustmentId = inventoryAdjustment.save();
                    log.debug({ title: 'Inventory Adjustment Created', details: 'Adjustment ID: ' + adjustmentId });
            }
             } catch (error) {
                log.error({ title: 'ERRORRRR', details: error });
            }
        }
        return {
            afterSubmit: afterSubmit
        };
    });
