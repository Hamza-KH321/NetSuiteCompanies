/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/log', 'SuiteScripts/ns_vc_enum_xml_order.js', 'N/file', 'N/render', 'N/https'], function (record, search, log, enumVal, file, render, https) {

    function beforeSubmit(context) {

        try {
            if (context.type !== context.UserEventType.COPY)
                return true;
            var soRecord = context.newRecord;
            for (var linetoRemove = 0; linetoRemove < soRecord.getLineCount({ sublistId: 'item' }); linetoRemove++) {
                soRecord.removeSublistSubrecord(
                    {
                        sublistId: "item",
                        fieldId: "inventorydetail",
                        line: linetoRemove
                    });

            }
        }
        catch (e) {
            log.error("Error before submit " + e.message);
        }
    }
    function afterSubmit(context) {

        var batches_released = false;
        var changeSORecord = true;
        try {
            if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT && context.type !== context.UserEventType.XEDIT) {
                log.debug("Action " + context.type + " not supported");
                return;
            }

            log.debug("Entered beginning")
            var newRecord = context.newRecord;
            var recordId = newRecord.id;
            var recordType = newRecord.type;

            var locationId = newRecord.getValue({ fieldId: 'location' });
            var performAllocation = newRecord.getValue({ fieldId: 'custbody_vs_perform_soft_allocation' });
            var allocationPerformed = newRecord.getValue('custbody_vs_allocation_done');

            if (performAllocation || allocationPerformed) {

                if (!allocationPerformed) {
                    if (!locationId) {
                        log.error({ title: 'Missing Location', details: 'Skipping search execution' });
                        //return;
                    }

                    var itemQuantities = [];
                    var lineCount = newRecord.getLineCount({ sublistId: 'item' });

                    for (var i = 0; i < lineCount; i++) {
                        var itemId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                        var quantity = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });

                        if (itemId) {
                            itemQuantities.push({ item: itemId, quantity: quantity, lineIndex: i });
                        }
                    }

                    if (itemQuantities.length === 0) {
                        log.error({ title: 'No Items Found', details: 'Skipping search execution' });
                        changeSORecord = false;
                        //return;
                    }

                    var itemFilterArray = itemQuantities.map(obj => obj.item);

                    var inventorySearch = search.create({
                        type: "inventorynumber",
                        filters: [
                            ["quantityavailable", "greaterthan", "0"],
                            "AND",
                            // ["expirationdate", "after", "today"],
                            [["expirationdate", "isempty", ""], "OR", ["expirationdate", "onorafter", "today"]],
                            "AND",
                            ["item", "anyof"].concat(itemFilterArray),
                            "AND",
                            ["location", "anyof", locationId]
                            , "AND", ["formulatext: (case when ({expirationdate} - {today}) > 90 then 'T' else 'F' end)", "is", "T"]
                        ],
                        columns: [
                            search.createColumn({ name: "internalid", label: "Internal ID" }),
                            search.createColumn({ name: "inventorynumber", label: "Number" }),
                            search.createColumn({ name: "item", label: "Item" }),
                            search.createColumn({ name: "expirationdate", label: "Expiration Date" }),
                            search.createColumn({ name: "location", label: "Warehouse" }),
                            search.createColumn({ name: "quantityavailable", label: "Available" })
                        ]
                    });

                    var searchResults = [];
                    inventorySearch.run().each(function (result) {
                        searchResults.push({
                            internalId: result.getValue({ name: "internalid" }),
                            inventoryNumber: result.getValue({ name: "inventorynumber" }),
                            item: result.getValue({ name: "item" }),
                            expirationDate: result.getValue({ name: "expirationdate" }),
                            location: result.getValue({ name: "location" }),
                            quantityAvailable: parseFloat(result.getValue({ name: "quantityavailable" })) || 0
                        });
                        return true;
                    });

                    if (searchResults.length === 0) {
                        log.error({ title: 'No Inventory Found', details: 'Skipping assignment' });

                        changeSORecord = false;

                        var updatedRecord = record.load({ type: recordType, id: recordId, isDynamic: true });

                        itemQuantities.forEach((itemRequest) => {

                            var { item, quantity, lineIndex } = itemRequest;
                            var remainingQty = quantity;

                            updatedRecord.selectLine({ sublistId: 'item', line: parseInt(lineIndex) });
                            updatedRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'location', value: locationId });

                            var inventoryDetail = updatedRecord.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });


                            if (inventoryDetail) {
                                var assignmentCount = inventoryDetail.getLineCount({ sublistId: 'inventoryassignment' });

                                if (assignmentCount > 0)
                                    batches_released = true;

                            }
                        });

                        if (!batches_released) {
                            log.error("The record has no batches!, returning");
                            return;
                        }
                        else {
                            log.error("No batches available, but the record has batches, continuing");
                        }
                    }

                    var updatedRecord = record.load({ type: recordType, id: recordId, isDynamic: true });

                    itemQuantities.forEach((itemRequest) => {
                        var { item, quantity, lineIndex } = itemRequest;
                        var remainingQty = quantity;

                        updatedRecord.selectLine({ sublistId: 'item', line: parseInt(lineIndex) });
                        updatedRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'location', value: locationId });

                        var inventoryDetail = updatedRecord.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });

                        var existingQty = 0;

                        if (inventoryDetail) {
                            var assignmentCount = inventoryDetail.getLineCount({ sublistId: 'inventoryassignment' });

                            if (assignmentCount > 0)
                                batches_released = true;


                            for (var j = 0; j < assignmentCount; j++) {
                                var assignedQty = parseFloat(inventoryDetail.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', line: j })) || 0;
                                existingQty += assignedQty;
                            }
                        }

                        log.debug({ title: `Existing Inventory Detail for Item ${item}`, details: `Assigned: ${existingQty}, Required: ${quantity}` });

                        if (existingQty < quantity) {
                            var qtyToAssign = quantity - existingQty;

                            for (var i = 0; i < searchResults.length && qtyToAssign > 0; i++) {
                                var soRecord = searchResults[i];

                                if (soRecord.item !== item || soRecord.quantityAvailable <= 0) {
                                    continue;
                                }

                                var allocatedQty = Math.min(qtyToAssign, soRecord.quantityAvailable);

                                inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });

                                inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: soRecord.internalId });
                                inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: allocatedQty });

                                inventoryDetail.commitLine({ sublistId: 'inventoryassignment' });

                                soRecord.quantityAvailable -= allocatedQty;
                                qtyToAssign -= allocatedQty;
                            }

                            if (qtyToAssign > 0) {
                                log.error({ title: `Insufficient Inventory for Item ${item}`, details: `Missing Quantity: ${qtyToAssign}` });
                            }
                        }

                        updatedRecord.commitLine({ sublistId: 'item' });
                    });

                    updatedRecord.setValue('custbody_vs_perform_soft_allocation', false);
                    updatedRecord.setValue('custbody_vs_allocation_done', true);

                    updatedRecord.save();

                    log.audit({ title: 'Record Updated Successfully', details: `Record ID: ${recordId}` });


                    //now sending to WMS:
                }//if allocation not performed
                try {
                    if (context.type === context.UserEventType.CREATE || context.type === context.UserEventType.XEDIT || context.type === context.UserEventType.EDIT || context.type === context.UserEventType.APPROVE) {
                        log.debug("Entering the send to wms process for this SO");
                        var objNewOrder = context.newRecord;
                        var strOrderType = objNewOrder.type;
                        log.debug("order type: ", strOrderType);

                        if (strOrderType == 'salesorder') var strOrderEnum = record.Type.SALES_ORDER;
                        else
                            if (strOrderType == 'vendorreturnauthorization') var strOrderEnum = record.Type.VENDOR_RETURN_AUTHORIZATION;
                            else if (strOrderType == 'transferorder') var strOrderEnum = record.Type.TRANSFER_ORDER;

                        /*   if(objNewOrder.getValue('custbody_vs_allocation_done')==false || objNewOrder.getValue('custbody_vs_allocation_done')=="F")
                             {
                               log.error({ title: 'Allocation Not Done', details: 'Allocation Not Done' });
                                objNewOrder.setValue('custbody_ns_vc_trans_error_interfacing',true);
                                objNewOrder.setValue('custbody_ns_vc_trans_error_details',"Internal Error: " + "Soft Allocation has not been performed");
                               return;
                             }
                        */
                        //load order record to get status & tran id
                        var objLoadedOrder = record.load({
                            type: strOrderEnum,
                            id: objNewOrder.id
                        })

                        var strOrderStatus = objLoadedOrder.getText({ fieldId: 'status' });
                        log.debug("order status: ", strOrderStatus);

                        if (strOrderStatus == "Pending Approval" || strOrderStatus == "Closed" || strOrderStatus == "Cancelled") {
                            log.error(_LOGGER_TITLE, "Order not approved");
                        } else {
                            var objOrderJSON = generateJSON(objLoadedOrder, context.type, strOrderType, strOrderEnum);
                            log.debug("order json in after submit: ", objOrderJSON);
                            if (isNotNull(objOrderJSON)) var objXMLContent = generateXML(objOrderJSON, objLoadedOrder, strOrderEnum);
                            log.debug("xml in after submit: ", objXMLContent);
                            if (isNotNull(objOrderJSON) && isNotNull(objXMLContent)) sendOrderRequest(objLoadedOrder, objXMLContent, strOrderEnum);
                        }
                    }
                }
                catch (error) {
                    log.error(_LOGGER_TITLE, error);
                }
            }

        } catch (error) {
            log.error({ title: 'Error in afterSubmit', details: error });
        }
    }

    function sendOrderRequest(objLoadedOrder, objXMLContent, strOrderEnum) {
        var _LOGGER_TITLE = '<<< Send Order Request >>>';
        try {
            //POST request
            var objHeader = {
                "Content-Type": "text/plain",
                "Accept": "*/*"
            };
            // return true;
            var objResponse = https.post({
                //url: "https://vitacare-wms-service-test-181839338436.us-central1.run.app/sales-order/service",
                //url:"https://soa12ctest.tamergroup.com/soa-infra/resources/vitacare/InboundMessageDispatcher!1.0/RestService/incomingPayload",
                url: "https://soa12cprod.tamergroup.com/soa-infra/resources/vitacare/InboundMessageDispatcher!1.0/RestService/incomingPayload",
                body: objXMLContent,
                headers: objHeader
            });
            var objBody = objResponse.body;
            var objCode = objResponse.code;
            var objHeaders = objResponse.headers;
            log.debug("response body: ", objBody); // see https.ClientResponse.body
            log.debug("response code: ", objCode); // see https.ClientResponse.code
            log.debug("response headers: ", objHeaders); // see https.Clientresponse.headers

            /*
            //load order to set error fields
            var objLoadedOrder = record.load({
                type: strOrderEnum,
                id: objNewOrder.id
            })
            */

            if (objCode != 200) {
                objLoadedOrder.setValue('custbody_ns_vc_trans_error_interfacing', true);
                objLoadedOrder.setValue('custbody_ns_vc_trans_error_details', "Error in sending data: " + " response headers: " + objHeaders + " response body " + objBody);
                objLoadedOrder.setValue({ fieldId: 'custbody_vs_so_integration_status', value: 'Not Sent ' + objBody })
                objLoadedOrder.save();
            }
            else {
                objLoadedOrder.setValue('custbody_ns_vc_trans_error_interfacing', false);
                objLoadedOrder.setValue('custbody_ns_vc_trans_error_details', "");
                objLoadedOrder.setValue({ fieldId: 'custbody_vs_so_integration_status', value: 'Sent ' + objBody })
                objLoadedOrder.save();
            }
        }
        catch (error) {
            objLoadedOrder.setValue('custbody_ns_vc_trans_error_interfacing', true);
            objLoadedOrder.setValue('custbody_ns_vc_trans_error_details', "Internal Error: " + error.toString());
            objLoadedOrder.setValue({ fieldId: 'custbody_vs_so_integration_status', value: 'Not Sent ' + error.toString() })
            objLoadedOrder.save();
            log.error(_LOGGER_TITLE, error);
        }
    }

    function generateJSON(objLoadedOrder, actionCode, strOrderType, strOrderEnum) {
        var _LOGGER_TITLE = '<<< Generate JSON >>>';
        try {
            var objOrderJSON = enumVal.objOrderJSON;
            //order header

            //harcoded values
            //action code = CREATE
            objOrderJSON.order_hdr.action_code = 'CREATE';
            //company code = VITACARE
            objOrderJSON.order_hdr.company_code = 'VITACARE';

            //dynamic values
            var intOrderId = objLoadedOrder.id;
            if (isNotNull(intOrderId)) {
                //hdr_group_nbr = sales order internal id
                objOrderJSON.order_hdr.hdr_group_nbr = intOrderId;
                //cust_field_1 = sales order internal id
                objOrderJSON.order_hdr.cust_field_1 = intOrderId;
            }
            //order type
            if (strOrderType == 'salesorder') objOrderJSON.order_hdr.order_type = 'SalesOrder';
            else
                if (strOrderType == 'vendorreturnauthorization') objOrderJSON.order_hdr.order_type = 'VRO';
                else if (strOrderType == 'transferorder') objOrderJSON.order_hdr.order_type = 'TO';
            //facility code = branch id from location
            var intLocationId = objLoadedOrder.getValue(enumVal.objFieldIds.Order.LOCATION);
            if (isNotNull(intLocationId)) {
                var objLocation = record.load({
                    type: record.Type.LOCATION,
                    id: intLocationId
                });
                var strBranchId = objLocation.getText({ fieldId: 'custrecord_5826_loc_branch_id' });
                if (isNotNull(strBranchId))
                    objOrderJSON.order_hdr.facility_code = strBranchId;
            }
            //order_nbr = order id & route_nbr = order nbr
            /*
            //reload order record to retrieve the tranid
            var objLoadedOrder = record.load({
                type: strOrderEnum,
                id: intOrderId
            });
            */

            var strOrderNo = objLoadedOrder.getText({ fieldId: 'tranid' });
            if (isNotNull(strOrderNo)) {
                objOrderJSON.order_hdr.order_nbr = strOrderNo;
                objOrderJSON.order_hdr.route_nbr = strOrderNo;
            }
            //ord_date = order date
            var dteOrderDate = formatNSDate(objLoadedOrder.getValue(enumVal.objFieldIds.Order.ORDER_DATE));
            if (isNotNull(dteOrderDate))
                objOrderJSON.order_hdr.ord_date = dteOrderDate;
            //ref_nbr = PO #
            if (isNotNull(objLoadedOrder.getText(enumVal.objFieldIds.Order.PURCHASE_ORDER)))
                objOrderJSON.order_hdr.ref_nbr = objLoadedOrder.getText(enumVal.objFieldIds.Order.PURCHASE_ORDER);

            //customer references for Sales Order
            if (strOrderType == 'salesorder') {
                //cust_name = entity
                if (isNotNull(objLoadedOrder.getText(enumVal.objFieldIds.Order.CUST_NAME))) {
                    // objOrderJSON.order_hdr.cust_name = objLoadedOrder.getText(enumVal.objFieldIds.Order.CUST_NAME); //OMAR CHANGED
                    objOrderJSON.order_hdr.cust_name = objLoadedOrder.getText(enumVal.objFieldIds.Order.CUST_NAME).split(' ')[0];
                }
                var intCustomerId = parseInt(objLoadedOrder.getValue({ fieldId: 'entity' }));
                if (isNotNull(intCustomerId)) {
                    //load customer record
                    var objCustomer = record.load({
                        type: record.Type.CUSTOMER,
                        id: intCustomerId
                    });
                    //cust_contact
                    if (isNotNull(objCustomer.getText(enumVal.objFieldIds.Order.CUST_CONTACT))) {
                        objOrderJSON.order_hdr.cust_contact = objCustomer.getText(enumVal.objFieldIds.Order.CUST_CONTACT);
                    }
                    //cust_nbr = customer number
                    if (isNotNull(objCustomer.getValue(enumVal.objFieldIds.Order.CUST_NBR))) {
                        objOrderJSON.order_hdr.cust_nbr = objCustomer.getText(enumVal.objFieldIds.Order.CUST_NBR);
                    }
                    //cust_city = customer city
                    if (isNotNull(objCustomer.getText(enumVal.objFieldIds.Order.CUST_CITY))) {
                        objOrderJSON.order_hdr.cust_city = objCustomer.getText(enumVal.objFieldIds.Order.CUST_CITY);
                    }

                    //new customer address
                    if (isNotNull(objLoadedOrder.getText("billingaddress_text"))) {
                        var customerFullAddress = objLoadedOrder.getText("billingaddress_text");
                        if (customerFullAddress.length > 70) {
                            //cust_addr = customer address < 70 char
                            objOrderJSON.order_hdr.cust_addr = customerFullAddress.substr(0, 70);
                            //cust_addr2 = customer address > 70 char
                            objOrderJSON.order_hdr.cust_addr2 = customerFullAddress.substr(70, 100);
                        }
                        else objOrderJSON.order_hdr.cust_addr = customerFullAddress;
                        log.error("Address after " + customerFullAddress)
                    }
                    //new customer address end


                    //customer address old
                    /*
                      if (isNotNull(objCustomer.getText(enumVal.objFieldIds.Order.CUST_ADDRESS))) {
                          var customerFullAddress = objCustomer.getText(enumVal.objFieldIds.Order.CUST_ADDRESS);
                          if (customerFullAddress.length > 70)
                          {
                              //cust_addr = customer address < 70 char
                              objOrderJSON.order_hdr.cust_addr = customerFullAddress.substr(0,70);
                              //cust_addr2 = customer address > 70 char
                              objOrderJSON.order_hdr.cust_addr2 = customerFullAddress.substr(70,100);
 
                              objOrderJSON.order_hdr.cust_addr3 = objLoadedOrder.getText(enumVal.objFieldIds.Order.CUST_NAME) //OMAR
                          }
                          else objOrderJSON.order_hdr.cust_addr = customerFullAddress;
                      }
                      */
                    //old customer address end
                }
            }
            //vendor reference for VRO
            if (strOrderType == 'vendorreturnauthorization') {
                //cust_name = entity
                if (isNotNull(objLoadedOrder.getText(enumVal.objFieldIds.Order.CUST_NAME))) {
                    objOrderJSON.order_hdr.cust_name = objLoadedOrder.getText(enumVal.objFieldIds.Order.CUST_NAME);
                }
                var intVendorId = parseInt(objLoadedOrder.getValue({ fieldId: 'entity' }));
                if (isNotNull(intVendorId)) {
                    //load vendor record
                    var objVendor = record.load({
                        type: record.Type.VENDOR,
                        id: intVendorId
                    });
                    //cust_contact = ship to name
                    if (isNotNull(objVendor.getText(enumVal.objFieldIds.Order.CUST_CONTACT))) {
                        objOrderJSON.order_hdr.cust_contact = objVendor.getText(enumVal.objFieldIds.Order.CUST_CONTACT);
                        objOrderJSON.order_hdr.shipto_name = objVendor.getText(enumVal.objFieldIds.Order.CUST_CONTACT);
                    }
                    //cust_nbr = vendor number = entity id
                    if (isNotNull(objVendor.getValue(enumVal.objFieldIds.Order.CUST_NBR))) {
                        objOrderJSON.order_hdr.cust_nbr = objVendor.getText(enumVal.objFieldIds.Order.CUST_NBR);
                    }
                    //cust_city = vendor city
                    if (isNotNull(objVendor.getText(enumVal.objFieldIds.Order.CUST_CITY))) {
                        objOrderJSON.order_hdr.cust_city = objVendor.getText(enumVal.objFieldIds.Order.CUST_CITY);
                        objOrderJSON.order_hdr.shipto_city = objVendor.getText(enumVal.objFieldIds.Order.CUST_CITY);
                    }
                    //vendor address = ship to address
                    if (isNotNull(objVendor.getText(enumVal.objFieldIds.Order.CUST_ADDRESS))) {
                        var vendorFullAddress = objVendor.getText(enumVal.objFieldIds.Order.CUST_ADDRESS);
                        if (vendorFullAddress.length > 70) {
                            //cust_addr = customer address < 70 char
                            objOrderJSON.order_hdr.cust_addr = vendorFullAddress.substr(0, 70);
                            objOrderJSON.order_hdr.shipto_addr = vendorFullAddress.substr(0, 70);
                            //cust_addr2 = customer address > 70 char
                            objOrderJSON.order_hdr.cust_addr2 = vendorFullAddress.substr(70, 100);
                            objOrderJSON.order_hdr.shipto_addr2 = vendorFullAddress.substr(70, 100);
                        }
                        else {
                            objOrderJSON.order_hdr.cust_addr = vendorFullAddress;
                            objOrderJSON.order_hdr.shipto_addr = vendorFullAddress;
                        }
                    }
                }
            }

            if (strOrderType == "transferorder") {
                //cust_name = receiving location
                var intLocationId = objLoadedOrder.getValue({ fieldId: 'transferlocation' });
                if (isNotNull(intLocationId)) {
                    var objLocation = record.load({
                        type: record.Type.LOCATION,
                        id: intLocationId
                    });
                    var strBranchId = objLocation.getText({ fieldId: 'custrecord_5826_loc_branch_id' });
                    if (isNotNull(strBranchId))
                        objOrderJSON.order_hdr.cust_name = strBranchId;
                }
                objOrderJSON.order_hdr.cust_contact = 'TO';
                objOrderJSON.order_hdr.shipto_name = 'TO';
                objOrderJSON.order_hdr.cust_nbr = 'TO';
                objOrderJSON.order_hdr.cust_city = 'TO';
                objOrderJSON.order_hdr.shipto_city = 'TO';
                objOrderJSON.order_hdr.shipto_addr = 'TO';
            }

            //priority = custbody1
            if (isNotNull(objLoadedOrder.getText(enumVal.objFieldIds.Order.PRIORITY)))
                objOrderJSON.order_hdr.priority = objLoadedOrder.getText(enumVal.objFieldIds.Order.PRIORITY);
            //sales_channel = custbody_sales_channel
            if (isNotNull(objLoadedOrder.getText(enumVal.objFieldIds.Order.SALES_CHANNEL)))
                objOrderJSON.order_hdr.sales_channel = objLoadedOrder.getText(enumVal.objFieldIds.Order.SALES_CHANNEL);
            //spl_instr = custbody_spl_intr
            if (isNotNull(objLoadedOrder.getText(enumVal.objFieldIds.Order.SPL_INSTR)))
                objOrderJSON.order_hdr.spl_instr = objLoadedOrder.getText(enumVal.objFieldIds.Order.SPL_INSTR);
            //gift_msg = custbody_gift_msg
            if (isNotNull(objLoadedOrder.getText(enumVal.objFieldIds.Order.GIFT_MSG)))
                objOrderJSON.order_hdr.gift_msg = objLoadedOrder.getText(enumVal.objFieldIds.Order.GIFT_MSG);
            //end order header

            //order detail
            var intItemCounter = objLoadedOrder.getLineCount({ sublistId: 'item' });
            //log.debug("item count: ",intItemCounter);
            var arrOrderDtl = [];
            var intSequence = 1;
            for (var i = 0; i < intItemCounter; i++) {
                //cust_field_5 = line unique key
                var intLineKey = objLoadedOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'lineuniquekey',
                    line: i
                });
                //item_alternate_code = item_part_a = item number
                var intItemId = objLoadedOrder.getSublistText({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });
                //ord_qty = quantity
                var intQuantity = objLoadedOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                });
                //cust_field_1 = unit
                var intUnit = objLoadedOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'units',
                    line: i
                });
                //cust_field_2 = item internal id
                var intItemInternalId = objLoadedOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });
                //batch_nbr = Lot Number of an item - Inventory Detail
                var intInvDetail = objLoadedOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'inventorydetail',
                    line: i
                });
                //log.debug("inventory detail id: ",intInvDetail);
                if (isNotNull(intInvDetail)) {
                    var objInvSubrecord = objLoadedOrder.getSublistSubrecord({
                        sublistId: 'item',
                        fieldId: 'inventorydetail',
                        line: i
                    });
                    //log.debug("subrecord: ",objInvSubrecord);
                    var intInvAssignCount = objInvSubrecord.getLineCount({
                        sublistId: 'inventoryassignment'
                    });
                    //log.debug("inventory assignment counter: ",intInvAssignCount);
                    for (var j = 0; j < intInvAssignCount; j++) {
                        var intInvNumber = objInvSubrecord.getSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'issueinventorynumber',
                            line: j
                        });
                        var intInvQuantity = objInvSubrecord.getSublistValue({
                            sublistId: "inventoryassignment",
                            fieldId: "quantity",
                            line: j
                        });
                        //log.debug("inventory number: ",intInvNumber);
                        var objInvNumber = record.load({
                            type: record.Type.INVENTORY_NUMBER,
                            id: intInvNumber
                        });
                        var intInvLot = objInvNumber.getText(enumVal.objFieldIds.Order.BATCH_NBR);
                        //log.debug("inventory lot number: ",intInvLot);
                        if (isNotNull(intInvLot)) {
                            var objLine = {
                                hdr_group_nbr: intOrderId,
                                facility_code: strBranchId,
                                company_code: 'VITACARE',
                                order_nbr: intOrderId,
                                seq_nbr: intSequence,
                                item_alternate_code: intItemId,
                                item_part_a: intItemId,
                                ord_qty: intInvQuantity,
                                batch_nbr: intInvLot,
                                cust_field_1: intUnit,
                                cust_field_2: intItemInternalId,
                                cust_field_3: 0,
                                cust_field_5: intLineKey,
                                cust_number_1: intOrderId
                            }
                            arrOrderDtl.push(objLine);
                            intSequence++;
                        }
                    }
                }
                else { //here is the part where we dont push inventory wit no lot number
                    /*  var objLine = {
                          hdr_group_nbr: intOrderId,
                          facility_code: strBranchId,
                          company_code: 'VITACARE',
                          order_nbr: intOrderId,
                          seq_nbr: intSequence,
                          item_alternate_code: intItemId,
                          item_part_a: intItemId,
                          ord_qty: intQuantity,
                          cust_field_1: intUnit,
                          cust_field_2: intItemInternalId,
                          cust_field_5: intLineKey,
                          cust_number_1: intOrderId
                      }
                      arrOrderDtl.push(objLine);
                      intSequence++;
                  */
                }
            }
            objOrderJSON.order_dtl = arrOrderDtl;
            //end order detail
            //log.debug("order json in generate json: ",objOrderJSON);
            return objOrderJSON;
        }
        catch (error) {
            log.error(_LOGGER_TITLE, error);
            objLoadedOrder.setValue('custbody_ns_vc_trans_error_interfacing', true);
            objLoadedOrder.setValue('custbody_ns_vc_trans_error_details', "Internal Error: " + error.toString());
            objLoadedOrder.save();
        }
    }

    function generateXML(objOrderJSON, objLoadedOrder, strOrderEnum) {
        var _LOGGER_TITLE = '<<< Generate XML >>>';
        try {
            var objTemplateFile = file.load({
                id: enumVal.objFieldIds.Order.ORDER_XML_PROFILE_PATH
            });
            var xmlString = objTemplateFile.getContents();

            var objRenderer = render.create();
            objRenderer.templateContent = xmlString;

            //Add the values to the XML Content
            objRenderer.addCustomDataSource({
                format: render.DataSource.OBJECT,
                alias: 'objOrderJSON',
                data: objOrderJSON
            });
            var xmlContent = objRenderer.renderAsString();
            //log.debug("order json in generate xml: ",objOrderJSON);
            //log.debug("xml in generate xml",xmlContent);
            return xmlContent;
        }
        catch (error) {
            log.error(_LOGGER_TITLE, error);
            /*
            var objLoadedOrder = record.load({
                type: strOrderEnum,
                id: objNewOrder.id
            });
            */
            objLoadedOrder.setValue('custbody_ns_vc_trans_error_interfacing', true);
            objLoadedOrder.setValue('custbody_ns_vc_trans_error_details', "Internal Error: " + error.toString());
            objLoadedOrder.save();
        }
    }

    //other functions
    function isNotNull(value) {
        if (value != 'null' && value != null && value != null && value != '' && value != undefined && value != undefined && value != 'undefined' && value != 'undefined' && value != 'NaN' && value != NaN) {
            return true;
        }
        else {
            return false;
        }
    }

    // function to add leading zeros on date parts.
    function zeroPad(num, len) {
        var str = num.toString();
        while (str.length < len) { str = '0' + str; }
        return str;
    }

    // function to format date object into YYYY-MM-DD format.
    function formatNSDate(dateObj) {
        if (dateObj) {
            var nsFormatDate = dateObj.getFullYear() + '-' + zeroPad(dateObj.getMonth() + 1, 2) + '-' + zeroPad(dateObj.getDate(), 2);
            return nsFormatDate;
        }
        return null;
    }

    return {
        afterSubmit: afterSubmit,
        beforeSubmit: beforeSubmit
    };

});
