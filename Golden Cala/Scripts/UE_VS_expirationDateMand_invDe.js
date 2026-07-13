
function beforeSubmit(scriptContext) {‌

 

                var newRec = scriptContext.newRecord;

                var itemCount = newRec.getLineCount({‌

                sublistId: 'item'

                })

 

                for (i=0; i<itemCount; i++) {‌

                var subRec = newRec.getSublistSubrecord({‌

                sublistId: 'item',

                fieldId: 'inventorydetail',

                line: i

                })

 

                                var inventoryAssignmentCount = subRec.getLineCount({‌sublistId:'inventoryassignment'})

 

                                for(j=0; j<inventoryAssignmentCount; j++){‌

                                var expirationDate = subRec.getSublistValue({‌

                                sublistId: 'inventoryassignment',

                                fieldId: 'expirationdate',

                                line: j

                                })

 

                                if (expirationDate == '' || expirationDate == null)

                                  throw error.create({‌

                                                  name:'EXP_DATE_EMPTY',

                                                  message: 'Expiration Date is empty for Inventory Detail',

                                                  notifyOff:false

                                  })

                                }

 

                }

}