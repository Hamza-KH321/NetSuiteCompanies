/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/record', "N/xml", 'N/search', 'N/config', 'N/runtime', './moment.min.js', "SuiteScripts/Library/vc_lib_1", 'N/file'],

	function (record, xml, search, config, runtime, moment, lib, file) {
		/**
		 * Definition of the Scheduled script trigger point.
		 *
		 * @param {Object} scriptContext
		 * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
		 * @Since 2015.2
		 */
		function execute(scriptContext) {

			var globalLot = "";
			var scriptObj = runtime.getCurrentScript();
			var globalSO = "";

			var fileId = scriptObj.getParameter({ name: 'custscript_vs_fileid' });

			log.debug('processing file ' + fileId);

			var fileObj = file.load({
				id: fileId
			});

			var str = fileObj.getContents()
			log.debug('file', str);

			var xmlObj = xml.Parser.fromString(
				{
					text: str
				});

			log.debug('parsed');
			//convert that string to json
			var jsonObj = lib.xmlToJson(xmlObj.documentElement);
			log.debug('xml to jsoned')
			var jsonObjCleaned = lib.cleanObject(jsonObj, true);
			log.debug('cleaned')
			var identifyProfile = jsonObjCleaned.ListOfShippedLoads.shipped_load.load.route_nbr;
			log.debug('identity profile', identifyProfile);

			try {
				var scriptObj = runtime.getCurrentScript();
				var arAccount = 1751;
				//var strJSONStatus = '';
				//var strJSONMessage = '';
				var status = 1; //Good Inventory Status
				if (lib.isNotNull(arAccount)) {
					var _LOGGER_TITLE = '<<< Create IF from TO >>>';
					/*
					var statusMap = {
						"DMG": "Damage",
						"QA": "Quarantine"
					}
					log.debug({ title: "requestBody", details: requestBody });
					var str = requestBody;
					var xmlObj = xml.Parser.fromString({
						text: str
					});
					//convert that string to json
					var jsonObj = lib.xmlToJson(xmlObj.documentElement);
					var jsonObjCleaned = lib.cleanObject(jsonObj, true);
					*/
					log.debug("jsonObjCleaned", JSON.stringify(jsonObjCleaned));
					//Gather SO internalid value from the xml inbound profile
					var strSO_NUM = null;
					if (jsonObjCleaned.ListOfShippedLoads && jsonObjCleaned.ListOfShippedLoads.shipped_load && jsonObjCleaned.ListOfShippedLoads.shipped_load.load && jsonObjCleaned.ListOfShippedLoads.shipped_load.load.route_nbr) {
						strSO_NUM = jsonObjCleaned.ListOfShippedLoads.shipped_load.load.route_nbr;
					}
					log.debug('strSO_NUM value from inbound profile', 'SO_Id value from inbound profile : ' + strSO_NUM);

					//Proceed further if we find the so id
					if (lib.isNotNull(strSO_NUM)) {
						globalSO = strSO_NUM;

						//confirm whether Sales Order exist in the system
						var objSOSearch = search.create(
							{
								type: "salesorder",
								filters: ["tranid", "anyof", strSO_NUM],
								columns: [
									search.createColumn(
										{
											name: "location",
											label: "Warehouse"
										})
								]
							}).run().getRange(0, 1);
						var k = 0;

						//if Sales Order Present
						if (objSOSearch && objSOSearch.length > 0) {
							//transform

							var soRecord = record.load({ type: 'salesorder', id: objSOSearch[0].id, isDynamic: false });

							/* ======================= NEW LOGIC START ======================= */
							// Check if Sales Order is Consignment Order
							var isConsignment = soRecord.getValue({ fieldId: 'custbody_vs_consignment_order' });
							var oldLocation = soRecord.getValue({ fieldId: 'location' });
							log.debug('Is Consignment Order', isConsignment);

							if (isConsignment) {

								log.audit('Consignment Flow', 'Starting Inventory Transfer creation');

								var intLocationConsignment = objSOSearch[0].getValue('location');
								log.debug('SO Location for Consignment Transfer', intLocationConsignment);

								// ✅ NEW: Remove inventory detail from SO BEFORE creating Inventory Transfer
								try {
									var soIdToUpdate = objSOSearch[0].id;

									log.debug('Pre-Process - Removing Inventory Detail from SO', soIdToUpdate);

									var soRecToUpdate = record.load({
										type: record.Type.SALES_ORDER,
										id: soIdToUpdate,
										isDynamic: false
									});

									var soLineCount = soRecToUpdate.getLineCount({ sublistId: 'item' });

									for (var line = 0; line < soLineCount; line++) {
										try {
											soRecToUpdate.removeSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line: line });
										} catch (eRemove) {
											log.debug({
												title: 'No inventory detail to remove on line ' + line,
												details: eRemove
											});
										}
									}

									soRecToUpdate.save({ enableSourcing: true, ignoreMandatoryFields: true });

									log.audit('Pre-Process - Inventory Detail Removed from SO', soIdToUpdate);

								} catch (ePreRemove) {
									log.error({
										title: 'Error Removing Inventory Detail Before Transfer',
										details: ePreRemove
									});
									throw ePreRemove;
								}

								// Create Inventory Transfer
								var objTransfer = record.create({ type: 'inventorytransfer', isDynamic: true });

								objTransfer.setValue({ fieldId: 'customform', value: 181 });
								objTransfer.setValue({ fieldId: 'subsidiary', value: 1 });
								objTransfer.setValue({ fieldId: 'location', value: intLocationConsignment });
								// objTransfer.setValue({ fieldId: 'transferlocation', value: 6 });

								var toLocation = null;

								try {

									var customerId = soRecord.getValue({ fieldId: 'entity' });
									log.debug('Customer ID from SO', customerId);

									if (!customerId) {
										log.error('Missing Customer on SO', 'entity field is empty');
										throw 'Customer is required on Sales Order';
									}

									var customerRec = record.load({ type: record.Type.CUSTOMER, id: customerId, isDynamic: false });

									toLocation = customerRec.getValue({ fieldId: 'custentityvs_consignment_location' });

									log.debug('Customer Consignment Location', toLocation);

									if (!toLocation) {
										log.error('Missing Consignment Location on Customer', customerId);
										throw 'Customer does not have consignment location defined';
									}

								} catch (eGetLocation) {

									log.error({
										title: 'Error getting consignment location from customer',
										details: eGetLocation
									});

									throw eGetLocation;
								}

								objTransfer.setValue({ fieldId: 'transferlocation', value: toLocation });

								try {
									var soInternalId = objSOSearch[0].id;
									log.debug('Consignment Linking - SO Internal ID', soInternalId);

									objTransfer.setValue({ fieldId: 'custbody_vs_consignment_sales_order', value: parseInt(soInternalId, 10) });

									log.debug('Consignment Linking - IT custbody_vs_consignment_sales_order set', soInternalId);
								} catch (eLink1) {
									log.error({ title: 'Consignment Linking - Error setting SO on Inventory Transfer', details: eLink1 });
									throw eLink1;
								}

								log.debug('Inventory Transfer Header Set', 'Form, Subsidiary, Locations assigned');

								// ================= XML INVENTORY DATA =================
								var arrInventoryData = jsonObjCleaned.ListOfShippedLoads.shipped_load.ob_stop;

								if (!Array.isArray(arrInventoryData)) {
									arrInventoryData = [arrInventoryData];
								}

								// Loop through XML items
								log.debug('Inventory Data Type', typeof arrInventoryData);
								log.debug('Inventory Data Length', arrInventoryData.length);
								log.debug('Inventory Data Content', JSON.stringify(arrInventoryData));

								for (var idx = 0; idx < arrInventoryData.length; idx++) {

									try {

										var objData = arrInventoryData[idx];

										log.debug('---- LOOP INDEX ----', idx);
										// log.debug('Raw Line Data', JSON.stringify(objData));

										var itemId = lib.toInt(objData.order_dtl_cust_field_2);
										var lotNumber = objData.batch_nbr;
										var quantity = parseInt(objData.shipped_qty);

										log.debug('Processing Item', itemId + ' | Qty: ' + quantity + ' | Lot: ' + lotNumber);

										objTransfer.selectNewLine({ sublistId: 'inventory' });

										objTransfer.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'item', value: itemId });
										objTransfer.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'adjustqtyby', value: quantity });

										var requiresInvDetail = objTransfer.getCurrentSublistValue({ sublistId: 'inventory', fieldId: 'inventorydetailreq' });

										log.debug('Requires Inventory Detail?', requiresInvDetail);

										if (requiresInvDetail === true || requiresInvDetail === 'T') {

											var invDetail = objTransfer.getCurrentSublistSubrecord({ sublistId: 'inventory', fieldId: 'inventorydetail' });

											log.debug('Inventory Subrecord Loaded', true);

											invDetail.selectNewLine({
												sublistId: 'inventoryassignment'
											});

											log.debug('Inventory Assignment Line Created', true);

											invDetail.setCurrentSublistText({ sublistId: 'inventoryassignment', fieldId: 'receiptinventorynumber', text: lotNumber });
											invDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: quantity });

											invDetail.commitLine({ sublistId: 'inventoryassignment' });

											log.debug('Inventory Assignment Committed', true);
										}

										objTransfer.commitLine({ sublistId: 'inventory' });

										log.debug('Inventory Item Line Committed', itemId);

									} catch (loopError) {

										log.error({
											title: 'Error Inside Loop Index ' + idx,
											details: loopError
										});

										throw loopError;
									}
								}

								var transferId = null;
								try {
									transferId = objTransfer.save({ enableSourcing: true, ignoreMandatoryFields: true });

									log.audit('Consignment Inventory Transfer Created', transferId);

									// ✅ NEW: store Inventory Transfer internal id on Sales Order
									try {
										var soIdToUpdate = objSOSearch[0].id;

										log.debug('Consignment Linking - Updating SO with IT', 'SO=' + soIdToUpdate + ' IT=' + transferId);

										var soRecToUpdate = record.load({
											type: record.Type.SALES_ORDER,
											id: soIdToUpdate,
											isDynamic: false
										});

										soRecToUpdate.setValue({ fieldId: 'custbody_vs_consignment_inventory_tran', value: parseInt(transferId, 10) });

										// Remove inventory detail from SO lines after location change
										var soLineCount = soRecToUpdate.getLineCount({ sublistId: 'item' });

										for (var line = 0; line < soLineCount; line++) {
											try {
												soRecToUpdate.removeSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line: line });
											} catch (eRemove) {
												log.debug({
													title: 'No inventory detail to remove on line ' + line,
													details: eRemove
												});
											}
										}
										soRecToUpdate.setValue({ fieldId: 'location', value: toLocation }); // Consignment Location inside Customer Record
										soRecToUpdate.setValue({ fieldId: 'custbody_vs_original_warehouse', value: oldLocation });

										var soSavedId = soRecToUpdate.save({ enableSourcing: true, ignoreMandatoryFields: true });

										log.audit('Consignment Linking - SO updated with IT', soSavedId);

									} catch (eLink2) {
										log.error({
											title: 'Consignment Linking - Error updating SO with Inventory Transfer',
											details: eLink2
										});
										throw eLink2;
									}

								} catch (eSave) {
									log.error({
										title: 'Consignment Flow - Error saving Inventory Transfer',
										details: eSave
									});
									throw eSave;
								}

								// Stop execution for consignment
								return;
							}
							/* ======================= NEW LOGIC END ======================= */


							for (var linetoRemove = 0; linetoRemove < soRecord.getLineCount({ sublistId: 'item' }); linetoRemove++) {
								soRecord.removeSublistSubrecord(
									{
										sublistId: "item",
										fieldId: "inventorydetail",
										line: linetoRemove
									});

							}
							soRecord.save();


							var objItemFulfillment = record.transform(
								{
									fromType: record.Type.SALES_ORDER,
									toType: record.Type.ITEM_FULFILLMENT,
									fromId: objSOSearch[0].id,
									isDynamic: true
								});
							var intLocation = objSOSearch[0].getValue('location');
							log.debug('intLocation from SO', intLocation)
							objItemFulfillment.setValue(
								{
									fieldId: 'shipstatus',
									value: 'C'
								}) //Shipped Status


							var intItemLineCount = objItemFulfillment.getLineCount('item');

							for (var intIffItemLine = 0; intIffItemLine < intItemLineCount; intIffItemLine++) {
								objItemFulfillment.selectLine(
									{
										sublistId: "item",
										line: intIffItemLine
									});
								objItemFulfillment.setCurrentSublistValue(
									{
										sublistId: 'item',
										fieldId: 'itemreceive',
										value: false
									});

								objItemFulfillment.setCurrentSublistValue(
									{
										sublistId: 'item',
										fieldId: 'location',
										value: intLocation
									});

								objItemFulfillment.commitLine(
									{
										sublistId: "item"
									});
							}

							//Gather inventorydetail from the xml profile
							var objCopyItemInventoryDetails = {};
							var arrInventoryInbndDetails = jsonObjCleaned.ListOfShippedLoads.shipped_load.ob_stop;
							log.audit('Array.isArray(arrInventoryInbndDetails)', Array.isArray(arrInventoryInbndDetails))
							if (Array.isArray(arrInventoryInbndDetails)) {
								arrInventoryInbndDetails = arrInventoryInbndDetails;
							}
							else {
								arrInventoryInbndDetails = [arrInventoryInbndDetails]
							}
							//log.audit('arrInventoryInbndDetails received from xml', JSON.stringify(arrInventoryInbndDetails))

							if (arrInventoryInbndDetails.length > 0) {
								arrInventoryInbndDetails.forEach(function (objData) {

									var intItemId = lib.toInt(objData.order_dtl_cust_field_2);
									log.audit('intItemId from xml', intItemId)
									//Check whether item exist in the system
									var objItemSearch = search.create(
										{
											type: "item",
											filters: [
												["internalid", "anyof", intItemId]
											]
										}).run().getRange(0, 1);
									log.audit('item exists? ' + objItemSearch.length);
									if (objItemSearch && objItemSearch.length > 0) {
										var id = objItemSearch[0].id;
										var lot = (objData.batch_nbr);
										globalLot = lot;
										var quantity = objData.shipped_qty;
										var expiryDate = objData.expiry_date;
										var sqNum = lib.toInt(objData.seq_nbr)
										//var status = "Good";
										//log.audit(id+' '+lot+' '+quantity+' '+expiryDate+' '+sqNum);
										/*
											if (objData.lock_code["#text"]) {
												var status = statusMap[objData.lock_code["#text"]];
											}
											*/
										//Gather inventorydetail from the xml profile

										var strType = objItemSearch[0].recordType;

										log.debug(
											{
												title: "lot",
												details: lot
											});

										if (strType == "lotnumberedinventoryitem") {

											if (lot && lib.isNotNull(lot)) {
												//check if lot exists
												var objLotSearch = search.create(
													{
														type: "inventorynumber",
														filters: [
															//["inventorynumber", "is", lot],
															// "OR",["inventorynumber", "is", lot.toUpperCase()]//OMAR
															["formulatext: UPPER({inventorynumber})", "is", lot.toUpperCase()],
															"AND",
															["item", "anyof", intItemId],
															"AND",
															["location", "anyof", intLocation],
															"AND",
															["quantityavailable", "greaterthan", "0"]
														],
														columns: [
															search.createColumn({ name: "inventorynumber", label: "Item" })
														]
													}).run().getRange(0, 1);

												if (objLotSearch.length > 0) {
													lot = objLotSearch[0].getValue('inventorynumber')
													globalLot = lot;
													log.audit('THE SEARCH RESULT IS POSITIVE ' + lot);
												}
												//log.debug("1lot: ", lot);

												if (objLotSearch && objLotSearch.length > 0 || 1 == 1) //ADDED TO STOP CHECKING VALIDATION
												{

													if (objCopyItemInventoryDetails[id]) {
														if (objCopyItemInventoryDetails[id][lot]) {
															objCopyItemInventoryDetails[id][lot].quantity += parseInt(quantity);
															objCopyItemInventoryDetails[id][lot].status = status;
															objCopyItemInventoryDetails[id][lot].expiryDate = expiryDate;
															objCopyItemInventoryDetails[id][lot].sqNum = sqNum;
														}
														else {
															objCopyItemInventoryDetails[id][lot] = {};
															objCopyItemInventoryDetails[id][lot].quantity = parseInt(quantity);
															objCopyItemInventoryDetails[id][lot].status = status;
															objCopyItemInventoryDetails[id][lot].expiryDate = expiryDate;
															objCopyItemInventoryDetails[id][lot].sqNum = sqNum;
														}
														objCopyItemInventoryDetails[id].quantity += parseInt(quantity);
													}
													else {
														objCopyItemInventoryDetails[id] = {};
														objCopyItemInventoryDetails[id][lot] = {};
														objCopyItemInventoryDetails[id][lot].quantity = parseInt(quantity);
														objCopyItemInventoryDetails[id][lot].status = status;
														objCopyItemInventoryDetails[id].quantity = parseInt(quantity);
														objCopyItemInventoryDetails[id][lot].expiryDate = expiryDate;
														objCopyItemInventoryDetails[id][lot].sqNum = sqNum;
													}

												}
												else {
													log.error("Lot is missing", "Lot is not present in NetSuite");
													strJSONStatus = "Failed";
													strJSONMessage = globalSO + ' ' + intItemId + " Lot " + lot + " is missing from NetSuite";
													throw new Error(globalSO + ' ' + intItemId + " Lot " + lot + " is missing from NetSuite");
												}
											}
											else {
												log.error("Lot is missing", "Lot is missing. Please make sure you include in the request.");
												strJSONStatus = "Failed";
												strJSONMessage = "Lot is missing. Please make sure you include in the request.";
											}

										}
										else if (strType == "inventoryitem") {
											if (objCopyItemInventoryDetails[id]) {
												objCopyItemInventoryDetails[id].quantity += parseInt(quantity);
												objCopyItemInventoryDetails[id].status = status;
												objCopyItemInventoryDetails[id].seqNbr = sqNum;
											}
											else {
												objCopyItemInventoryDetails[id] = {};
												objCopyItemInventoryDetails[id].quantity = parseInt(quantity);
												objCopyItemInventoryDetails[id].status = status;
												objCopyItemInventoryDetails[id].seqNbr = sqNum;
											}
										}

									}
									else {
										log.error("Item Missing", 'Item Missing in the Account');
										strJSONStatus = "Failed";
										strJSONMessage = 'Item Missing in the Account';
									}
								});

								log.debug(
									{
										title: "copy inv details",
										details: objCopyItemInventoryDetails
									});

								//Loop through the line items and remove the exisitn inventorydetail and add the inventorydetail details received from xml profile
								for (var intItemLine = 0; intItemLine < intItemLineCount; intItemLine++) {
									var k = 0;
									objItemFulfillment.selectLine(
										{
											sublistId: "item",
											line: intItemLine
										});

									var intItemId = objItemFulfillment.getSublistValue(
										{
											sublistId: "item",
											fieldId: "item",
											line: intItemLine
										});

									var itemName_ = objItemFulfillment.getSublistText(
										{
											sublistId: "item",
											fieldId: "item",
											line: intItemLine
										});



									if (objCopyItemInventoryDetails[intItemId]) {
										log.debug('parseInt(objCopyItemInventoryDetails[intItemId].quantity)', parseInt(objCopyItemInventoryDetails[intItemId].quantity))
										objItemFulfillment.setCurrentSublistValue(
											{
												sublistId: "item",
												fieldId: "quantity",
												value: parseInt(objCopyItemInventoryDetails[intItemId].quantity)
											});

										objItemFulfillment.setCurrentSublistValue(
											{
												sublistId: "item",
												fieldId: "totalquantity",
												value: parseInt(objCopyItemInventoryDetails[intItemId].quantity)
											});

										//Remove existing inventorydetail


										var objInvDetailSubRec = objItemFulfillment.getCurrentSublistSubrecord(
											{
												sublistId: 'item',
												fieldId: 'inventorydetail'
											});
										//log.debug('objCopyItemInventoryDetails[intItemId]',objCopyItemInventoryDetails[intItemId])

										//check item type
										var objItemSearch = search.create(
											{
												type: "item",
												filters: [
													["internalid", "is", intItemId]
												]
											}).run().getRange(0, 1);

										var strItemType = '';
										if (objItemSearch && objItemSearch.length > 0) strItemType = objItemSearch[0].recordType;

										//add new inventorydetail from the xml profile

										Object.keys(objCopyItemInventoryDetails[intItemId]).forEach(function (lot) {

											//    log.debug('objCopyItemInventoryDetails[intItemId][lot]',objCopyItemInventoryDetails[intItemId][lot])
											if (lot != "quantity" && objCopyItemInventoryDetails[intItemId][lot] && lib.isNotNull(lot)) {


												if (strItemType == 'lotnumberedinventoryitem') {


													//log.debug("lot",lot)
													objInvDetailSubRec.selectNewLine(
														{
															sublistId: 'inventoryassignment',
														});


													objInvDetailSubRec.setCurrentSublistText(
														{
															sublistId: 'inventoryassignment',
															fieldId: 'issueinventorynumber',
															text: lot
														});

													objInvDetailSubRec.setCurrentSublistValue(
														{
															sublistId: 'inventoryassignment',
															fieldId: 'quantity',
															value: objCopyItemInventoryDetails[intItemId][lot].quantity
														});
													if (lib.isNotNull(objCopyItemInventoryDetails[intItemId][lot].expiryDate)) {
														//    log.debug('objCopyItemInventoryDetails[intItemId][lot].expiryDate',objCopyItemInventoryDetails[intItemId][lot].expiryDate)
														var value = objCopyItemInventoryDetails[intItemId][lot].expiryDate;
														//value=value.toString();
														//log.debug('value',value)

														var formattedDate = moment(value).format('DD/MM/YYYY');
														//log.debug('formattedDate',formattedDate)
														//added                                                      
														globalLot = lot;
														//log.audit('~THE ITEM AND BATCH ARE '+intItemId+' '+lot);



														objInvDetailSubRec.setCurrentSublistValue(
															{
																sublistId: 'inventoryassignment',
																fieldId: 'expirationdate',
																value: new Date(formattedDate)
															});
													}

													objInvDetailSubRec.setCurrentSublistValue(
														{
															sublistId: 'inventoryassignment',
															fieldId: 'inventorystatus',
															value: objCopyItemInventoryDetails[intItemId][lot].status
														});

													//commit inventorydetail sublist
													objInvDetailSubRec.commitLine(
														{
															sublistId: "inventoryassignment"
														});
												}
												log.debug('the last line number recorded. . . ' + intItemLine);
											}
											else if (strItemType == "inventoryitem") {
												objInvDetailSubRec.selectNewLine(
													{
														sublistId: 'inventoryassignment'
													});

												objInvDetailSubRec.setCurrentSublistValue(
													{
														sublistId: 'inventoryassignment',
														fieldId: 'quantity',
														value: objCopyItemInventoryDetails[intItemId].quantity
													});

												objInvDetailSubRec.setCurrentSublistValue(
													{
														sublistId: 'inventoryassignment',
														fieldId: 'inventorystatus',
														value: status
													});

												//    log.debug("inventory details after inventory adding: ", objInvDetailSubRec);
												//commit inventorydetail sublist
												objInvDetailSubRec.commitLine(
													{
														sublistId: "inventoryassignment"
													});
											}


											if (k == 0 && strItemType == "inventoryitem") {
												log.debug('removing first line ');
												objInvDetailSubRec.removeLine(
													{
														sublistId: 'inventoryassignment',
														line: 0
													});
												k++;
												//log.debug("After removal subrec ", objInvDetailSubRec);
											}

											//log.debug("inventory details before commit: ", objInvDetailSubRec);

										});



										//commit line item
										objItemFulfillment.commitLine(
											{
												sublistId: "item"
											});
									}
								}
								//Save the ITEM_FULFILLMENT Record
								var intItemFulFillId = objItemFulfillment.save(
									{
										enableSourcing: true,
										ignoreMandatoryFields: true
									});
								//log.audit("intItemFulFill saved", intItemFulFillId);

								return;
								if (lib.isNotNull(intItemFulFillId)) {

									var objInvFulfillLookup = search.lookupFields(
										{
											type: search.Type.ITEM_FULFILLMENT,
											id: parseInt(intItemFulFillId),
											columns: ['trandate']
										});
									var dateOfSupply = null;
									if (lib.isNotNull(objInvFulfillLookup.trandate))
										dateOfSupply = objInvFulfillLookup.trandate

									var objInvoiceTransformRec = record.transform(
										{
											fromType: record.Type.SALES_ORDER,
											toType: record.Type.INVOICE,
											fromId: objSOSearch[0].id,
											isDynamic: true
										});
									objInvoiceTransformRec.setValue(
										{
											fieldId: 'approvalstatus',
											value: 2,
											//ignoreFieldChange: false
										}) //approved
									var account = objInvoiceTransformRec.getValue('account');

									if (lib.isNotNull(dateOfSupply)) {
										var formattedDate = moment(dateOfSupply).format('DD/MM/YYYY');
										objInvoiceTransformRec.setValue(
											{
												fieldId: 'custbody_ns_date_of_supply',
												value: new Date(formattedDate)
											})
									}


									log.debug('account!', "account Id : " + account);
									if (!lib.isNotNull(account)) {
										objInvoiceTransformRec.setValue(
											{
												fieldId: 'account',
												value: arAccount
											});
									}



									var objItemFulfillmentRec = record.load(
										{
											type: record.Type.ITEM_FULFILLMENT,
											id: intItemFulFillId,
											isDynamic: true
										});
									//to handle partially fulfilled items
									toHandlePartialFulfillment(objItemFulfillmentRec, objInvoiceTransformRec)
									var intInvId = objInvoiceTransformRec.save(
										{
											enableSourcing: true,
											ignoreMandatoryFields: true
										});

									if (lib.isNotNull(intInvId)) {
										log.debug('Invoice record has been saved, id!', "Invoice Id : " + intInvId);

									}
									else {
										log.error("Failed To Create Invoice", 'Failed To Create Invoice');
										strJSONStatus = "Failed";
										strJSONMessage = 'Failed To Create Invoice';
									}

								}
								else {
									log.error("Failed To Create Item Fulfillment", 'Failed To Create Item Fulfillment');
									strJSONStatus = "Failed";
									strJSONMessage = 'Failed To Create Item Fulfillment';
								}


							}

							//log.audit("Success", "Item Fulfillment Record created Successfully : " + intItemFulFillId + " || Invoice Record Created Successfully : " + intInvId);
							strJSONStatus = "Success";
							strJSONMessage = "Item Fulfillment Record created Successfully : " + intItemFulFillId + " || Invoice Record Created Successfully : " + intInvId;

						}
						else {
							log.error('soid is missing', 'Sales Order is missing in the System NS Account');

							strJSONStatus = "Failed";
							strJSONMessage = "Sales Order is missing in the System NS Account"
						}
					}
					else {
						log.error('soid is missing', 'Sales Order is missing in the System NS Account');
						strJSONStatus = "Failed";
						strJSONMessage = "Sales Order is missing in NS, Please pass the sales order number"
					}
				}
				else {
					log.error('Script Parameter Value Missing', 'Script Parameter Value Missing');
					strJSONStatus = "Failed";
					strJSONMessage = "Script Parameter Value Missing"
				}
				var value = '<status>' + strJSONStatus + '</status> <message>' + strJSONMessage + '</message>';
				//log.audit('return value', value);
				return {
					"success": "true",
					"message": "success",
					"additional": "vc_rl_inbound_if_ob_load"
				};
				//return value.toString();

			}
			catch (e) {
				log.error(
					{
						title: 'Error in doPost ' + ' ' + globalSO + ' ' + intItemId + ' ' + globalLot,
						details: e.toString()
					});

				moreDtl = "Item ID is " + intItemId;

				strJSONStatus = "Error"
				strJSONMessage = e.message.toString() + " item id is " + intItemId;
				var value = '<status>' + strJSONStatus + '</status> <message>' + strJSONMessage + '</message>';
				return JSON.stringify(
					{
						"success": (strJSONStatus == "Success" ? "FALSE" : "FALSE"),
						"message": strJSONMessage + " item id is " + intItemId,
						"additional": "vc_rl_inbound_if_ob_load - "
					});   //value.toString();
			}


		}
		function toHandlePartialFulfillment(itemFulfillmentRecord, objRecordInv) {
			try {
				/* Get item fulfillment line item count */
				var invoiceItemCount = objRecordInv.getLineCount(
					{
						sublistId: 'item'
					});
				log.debug('invoice item count', invoiceItemCount);
				var ItemCount = itemFulfillmentRecord.getLineCount(
					{
						sublistId: 'item'
					});
				log.debug('IF item count', ItemCount);
				var lineNumbersToRemove = [];
				for (var i = 0; i < invoiceItemCount; i++) {
					//log.debug('i at start', i);
					/* Get item from item fulfillment */
					var itemId = objRecordInv.getSublistValue(
						{
							sublistId: 'item',
							fieldId: 'item',
							line: i
						});
					/* Get item qty from item fulfillment */
					var itemQty = objRecordInv.getSublistValue(
						{
							sublistId: 'item',
							fieldId: 'quantity',
							line: i
						});

					var rate = objRecordInv.getSublistValue(
						{
							sublistId: 'item',
							fieldId: 'rate',
							line: i
						});
					var amount = objRecordInv.getSublistValue(
						{
							sublistId: 'item',
							fieldId: 'amount',
							line: i
						});
					/* Search for that item on invoice */
					var lineNumber = itemFulfillmentRecord.findSublistLineWithValue(
						{
							sublistId: 'item',
							fieldId: 'item',
							value: itemId
						});
					log.debug('Item: ' + itemId, 'Qty: ' + itemQty + ' Rate : ' + rate + ' Amount : ' + amount + ' found at ' + lineNumber);
					/* If found */
					if (lineNumber != -1) {



						var fulfilledItemQty = itemFulfillmentRecord.getSublistValue(
							{
								sublistId: 'item',
								fieldId: 'quantity',
								line: lineNumber
							});
						log.debug('Fulfilled item qty', fulfilledItemQty);

						var amtIff = itemFulfillmentRecord.getSublistValue(
							{
								sublistId: 'item',
								fieldId: 'amount',
								line: lineNumber
							});
						log.debug('Fulfilled item qty', fulfilledItemQty);

						if (fulfilledItemQty) {

							objRecordInv.selectLine(
								{
									sublistId: 'item',
									line: i
								});

							objRecordInv.setCurrentSublistValue(
								{
									sublistId: 'item',
									fieldId: 'quantity',
									value: fulfilledItemQty,
									ignoreFieldChange: false
								});
							/*
							if (lib.isNotNull(rate))
							{
								objRecordInv.setCurrentSublistValue(
								{
									sublistId: 'item',
									fieldId: 'rate',
									value: rate,
									ignoreFieldChange: false
								});
							}
	
	
							if (lib.isNotNull(amount))
							{
								objRecordInv.setCurrentSublistValue(
								{
									sublistId: 'item',
									fieldId: 'amount',
									value: lib.toFloat(amount),
									ignoreFieldChange: false
								});
							}
							*/

							objRecordInv.commitLine(
								{
									sublistId: 'item'
								});


						}
						else {
							lineNumbersToRemove.push(i);
						}
					}
					else if (lineNumber == -1) {
						lineNumbersToRemove.push(i);
					}
					//log.debug('i at end', i);
				}

				log.audit(
					{
						title: 'lineNumbersToRemove',
						details: lineNumbersToRemove
					});

				for (var j = lineNumbersToRemove.length - 1; j >= 0; j--) {
					//log.debug("lineNumbersToRemove", "before lineNumbersToRemove : " + lineNumbersToRemove[j])
					objRecordInv.removeLine(
						{
							sublistId: 'item',
							line: lineNumbersToRemove[j]
						});
					//log.debug("lineNumbersToRemove", "after lineNumbersToRemove : " + lineNumbersToRemove[j])
				}
			}
			catch (e) {
				log.error("Error in to handle", JSON.stringify(e));
			}

		}

		return {
			execute: execute
		};

	});
