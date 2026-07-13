/**
 * Copyright (c) 1998-2020 Oracle NetSuite, Inc.
 * 2955 Campus Drive, Suite 100, San Mateo, CA, USA 94403-2511
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of NetSuite, Inc. ("Confidential Information").
 * You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license agreement
 * you entered into with NetSuite.
 *
 * Module Description
 *
 * Version            Date                    Author                                 Remarks
 * 1.00               13 Oct 2021            Dilip P,Alexandra Pripoaie            Initial version
 * 1.1                15 Nov 2021            Dilip P                               Added additional functinality to create invoice automatically once the item fulfillment is created for the salesorder
 * 1.2                Dec 2 2021             Dilip P                               Added Date Of Supply mapping lookup for Invoice Record creation
 * 1.3                Dec 15 2021            Dilip P                               Added a fix for location issue when trying to add inventory detail for item fulfillment from SO.


 * function: This will create IF from SO, TO and VRA based on the record type received in request.
 */


/**
 * @NApiVersion 2.x
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 * @author dilip.p@netsuite.com Dilip P
 */
define(['N/record', "N/xml", 'N/search', 'N/config', 'N/runtime', './moment.min.js', "SuiteScripts/Library/vc_lib_1", 'N/file', 'N/task'],

	function (record, xml, search, config, runtime, moment, lib, file, task) {

		/**
		 * Function called upon sending a POST request to the RESTlet.
		 *
		 * @param {string | Object} requestBody - The HTTP request body; request body will be passed into function as a string when request Content-Type is 'text/plain'
		 * or parsed into an Object when request Content-Type is 'application/json' (in which case the body must be a valid JSON)
		 * @returns {string | Object} HTTP response body; return string when request Content-Type is 'text/plain'; return Object when request Content-Type is 'application/json'
		 * @since 2015.2
		 */
		var strJSONStatus = '';
		var strJSONMessage = '';
		var globalLot = "";

		var globalSO = "";

		function doPost(requestBody) {
			var moreDtl = "";

			try {
				var _LOGGER_TITLE = '<<< POST Request >>>';

				var statusMap = {
					"DMG": "Damage",
					"QA": "Quarantine"
				}
				log.debug(
					{
						title: "requestBody",
						details: requestBody
					});
				var str = requestBody;




				log.debug('starting parsing')
				var xmlObj = xml.Parser.fromString(
					{
						text: str
					});
				log.debug('parsing done');
				//convert that string to json
				var jsonObj = lib.xmlToJson(xmlObj.documentElement);
				log.debug('xml to json done', jsonObj);
				var jsonObjCleaned = lib.cleanObject(jsonObj, true);
				log.debug("JSON CLEANED", jsonObjCleaned)
				var identifyProfile = jsonObjCleaned.ListOfShippedLoads.shipped_load.load.route_nbr;
				log.debug("identify profile: ", identifyProfile);
				if (lib.isNotNull(identifyProfile)) {
					if (identifyProfile.indexOf("TO") >= 0) {
						log.debug('creating file');
						//creating file

						//file search start
						var baseName = jsonObjCleaned.ListOfShippedLoads.shipped_load.load.route_nbr;
						var extension = 'txt'; // without the dot
						var finalName = baseName + '.' + extension;
						var index = 0;
						while (true) {
							var fileSearch = search.create({
								type: search.Type.FOLDER,
								filters: [
									['internalid', 'anyof', "90805"],
									'AND',
									['file.name', 'is', finalName]
								],
								columns: ['file.internalid']
							});

							var result = fileSearch.run().getRange({ start: 0, end: 1 });
							if (result.length === 0) {
								break; // no file exists, good to go
							}
							index++;
							finalName = baseName + '_' + index + '.' + extension;
						}
						//file search end


						var fileObj = file.create({
							name: finalName,//jsonObjCleaned.ListOfShippedLoads.shipped_load.load.route_nbr+'.txt',
							fileType: file.Type.PLAINTEXT,
							contents: requestBody
						});

						fileObj.folder = 90805;
						var fileId = fileObj.save();

						var now = new Date();
						var day = now.getDate();

						if (day < 10)
							var day = String(now.getDate())//.padStart(2, '0');

						var month = String(now.getMonth() + 1)//.padStart(2, '0'); // January is 0!
						var year = now.getFullYear();
						var hours = String(now.getHours())//.padStart(2, '0');
						var minutes = String(now.getMinutes())//.padStart(2, '0');

						var fileObj2 = file.create({
							name: jsonObjCleaned.ListOfShippedLoads.shipped_load.load.route_nbr + " " + day + '-' + month + '-' + year + ' ' + hours + '_' + minutes + " " + '.txt',
							fileType: file.Type.PLAINTEXT,
							contents: requestBody
						});

						fileObj.folder = 90805;
						var fileId = fileObj.save();

						strJSONMessage = createIFFromTOPicked(jsonObjCleaned);
					}
					else if (identifyProfile.indexOf("SO") >= 0) {
						log.debug('creating file');

						//file search

						//file search start
						var baseName = jsonObjCleaned.ListOfShippedLoads.shipped_load.load.route_nbr;
						var extension = 'txt'; // without the dot
						var finalName = baseName + '.' + extension;
						var index = 0;
						while (true) {
							var fileSearch = search.create({
								type: search.Type.FOLDER,
								filters: [
									['internalid', 'anyof', "90805"],
									'AND',
									['file.name', 'is', finalName]
								],
								columns: ['file.internalid']
							});


							var result = fileSearch.run().getRange({ start: 0, end: 1 });
							if (result.length === 0) {
								break; // no file exists, good to go
							}
							index++;
							finalName = baseName + '_' + index + '.' + extension;
						}
						//file search end
						//creating file  
						var fileObj = file.create({
							name: finalName,//jsonObjCleaned.ListOfShippedLoads.shipped_load.load.route_nbr+'.txt',
							fileType: file.Type.PLAINTEXT,
							contents: requestBody
						});

						fileObj.folder = 90805;
						var fileId = fileObj.save();

						createIFFromSO(jsonObjCleaned);


						/*  log.debug('RUNNING SCHEDULED SCRIPT - FIle ID '+fileId);
											  var mrTask = task.create({
												  taskType : task.TaskType.SCHEDULED_SCRIPT
											   });
											   mrTask.scriptId = 1812;
											   mrTask.deploymentId = 'customdeploy1';
											   mrTask.params = {
												  custscript_vs_fileid : fileId
											   };
											   mrTask.submit();
											   */
					}
					else if (identifyProfile.indexOf("VRA") >= 0) {
						createIFFromVRA(jsonObjCleaned);
					}
				}
				else {
					log.error(_LOGGER_TITLE, "Order ID missing from route_nbr");
					strJSONStatus = "Failed";
					strJSONMessage = "Order ID missing from route_nbr";
				}

				return JSON.stringify(
					{
						"success": (strJSONStatus == "Success" ? "TRUE" : "FALSE"),
						"message": strJSONMessage + " " + moreDtl,
						"additional": "1vc_rl_inbound_if_ob_load - "
					});

			}
			catch (error) {
				log.error(_LOGGER_TITLE, error);
				return JSON.stringify(
					{
						"success": "FALSE",
						"message": error.message,
						"additional": "vc_rl_inbound_if_ob_load - "
					});
			}


		}

		function createIFFromSO(jsonObjCleaned) {

			try {
				var scriptObj = runtime.getCurrentScript();
				var arAccount = scriptObj.getParameter(
					{
						name: 'custscript_ns_vc_ar_account'
					});
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
					var load_manifest = "";
					if (jsonObjCleaned.ListOfShippedLoads && jsonObjCleaned.ListOfShippedLoads.shipped_load && jsonObjCleaned.ListOfShippedLoads.shipped_load.load && jsonObjCleaned.ListOfShippedLoads.shipped_load.load.route_nbr) {
						strSO_NUM = jsonObjCleaned.ListOfShippedLoads.shipped_load.load.route_nbr;
					}
					log.debug('strSO_NUM value from inbound profile', 'SO_Id value from inbound profile : ' + strSO_NUM);

					if (jsonObjCleaned.ListOfShippedLoads.shipped_load.load && jsonObjCleaned.ListOfShippedLoads.shipped_load.load.load_manifest_nbr) {
						load_manifest = jsonObjCleaned.ListOfShippedLoads.shipped_load.load.load_manifest_nbr;
						log.audit("manifset number " + load_manifest)
					}

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

								// Create Inventory Transfer
								var objTransfer = record.create({ type: 'inventorytransfer', isDynamic: true });

								objTransfer.setValue({ fieldId: 'customform', value: 242 });
								objTransfer.setValue({ fieldId: 'subsidiary', value: 1 });
								objTransfer.setValue({ fieldId: 'location', value: intLocationConsignment });
								objTransfer.setValue({ fieldId: 'transferlocation', value: 6 });

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
										log.debug('Raw Line Data', JSON.stringify(objData));

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
										soRecToUpdate.setValue({ fieldId: 'location', value: 6 });
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
								soRecord.removeSublistSubrecord({ sublistId: "item", fieldId: "inventorydetail", line: linetoRemove });
							}
							soRecord.save();
							//transform
							var objItemFulfillment = record.transform(
								{
									fromType: record.Type.SALES_ORDER,
									toType: record.Type.ITEM_FULFILLMENT,
									fromId: objSOSearch[0].id,
									isDynamic: true
								});

							//number of cartons
							var numCartons = "";
							if (jsonObjCleaned.ListOfShippedLoads && jsonObjCleaned.ListOfShippedLoads.shipped_load && jsonObjCleaned.ListOfShippedLoads.shipped_load.load && jsonObjCleaned.ListOfShippedLoads.shipped_load.load.total_nbr_of_oblpns) {
								numCartons = jsonObjCleaned.ListOfShippedLoads.shipped_load.load.total_nbr_of_oblpns;
								objItemFulfillment.setValue('custbody_vs_total_num_cartons', numCartons);
							}

							var intLocation = objSOSearch[0].getValue('location');
							log.debug('intLocation from SO', intLocation)
							objItemFulfillment.setValue(
								{
									fieldId: 'shipstatus',
									value: 'C'
								})

							objItemFulfillment.setValue('custbody_vs_fulfillment_loadnum', load_manifest);

							var intItemLineCount = objItemFulfillment.getLineCount('item');

							for (var intIffItemLine = 0; intIffItemLine < intItemLineCount; intIffItemLine++) {
								objItemFulfillment.selectLine({ sublistId: "item", line: intIffItemLine });
								objItemFulfillment.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: false });
								objItemFulfillment.setCurrentSublistValue({ sublistId: 'item', fieldId: 'location', value: intLocation });

								objItemFulfillment.commitLine({ sublistId: "item" });
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
										var quantity = objData.shipped_qty;
										var expiryDate = objData.expiry_date;
										var sqNum = lib.toInt(objData.seq_nbr)
										globalLot = lot;
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
															["location", "anyof", intLocation]
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
												log.debug("1lot: ", lot);

												if (objLotSearch && objLotSearch.length > 0) {

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
													strJSONMessage = "Lot " + lot + " is missing from NetSuite";
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

										objItemFulfillment.removeCurrentSublistSubrecord(
											{
												sublistId: "item",
												fieldId: "inventorydetail"
											});

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
												globalLot = lot;
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

												globalLot = lot;

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
										objItemFulfillment.commitLine({ sublistId: "item" });
									}
								}
								//Save the ITEM_FULFILLMENT Record
								var intItemFulFillId = objItemFulfillment.save(
									{
										enableSourcing: true,
										ignoreMandatoryFields: true
									});
								//log.audit("intItemFulFill saved", intItemFulFillId);


								//returning to skip the invoicing
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
											ignoreFieldChange: false
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
						title: 'Error in doPost ' + globalSO + ' ' + intItemId + ' ' + globalLot,
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

		function createIFFromVRA(jsonObjCleaned) {
			try {
				var status = 1;
				// var strJSONStatus = '';
				//var strJSONMessage = '';
				var _LOGGER_TITLE = '<<< Create IF from VRA >>>';
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
				//Gather SO internalid value from the xml inbound profile
				var strVRA_NUM = null;
				if (jsonObjCleaned.ListOfShippedLoads && jsonObjCleaned.ListOfShippedLoads.shipped_load && jsonObjCleaned.ListOfShippedLoads.shipped_load.load && jsonObjCleaned.ListOfShippedLoads.shipped_load.load.route_nbr) {
					strVRA_NUM = jsonObjCleaned.ListOfShippedLoads.shipped_load.load.route_nbr;
				}
				log.debug('strVRA_NUM value from inbound profile', 'VRA_ID value from inbound profile : ' + strVRA_NUM);

				//Proceed further if we find the VENDOR_RETURN_AUTHORIZATION id
				if (lib.isNotNull(strVRA_NUM)) {

					//confirm whether VRA exist in the system
					var objVRASearch = search.create(
						{
							type: "vendorreturnauthorization",
							filters: ["tranid", "anyof", strVRA_NUM]
						}).run().getRange(0, 1);

					//if VRA is  Present
					if (objVRASearch && objVRASearch.length > 0) {

						var toRecord = record.load({ type: record.Type.VENDOR_RETURN_AUTHORIZATION, id: objVRASearch[0].id, isDynamic: false });
						for (var linetoRemove = 0; linetoRemove < toRecord.getLineCount({ sublistId: 'item' }); linetoRemove++) {
							toRecord.removeSublistSubrecord(
								{
									sublistId: "item",
									fieldId: "inventorydetail",
									line: linetoRemove
								});

						}
						toRecord.save();
						//transform
						var objItemFulfillment = record.transform(
							{
								fromType: record.Type.VENDOR_RETURN_AUTHORIZATION,
								toType: record.Type.ITEM_FULFILLMENT,
								fromId: objVRASearch[0].id,
								isDynamic: true
							});
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
								//log.audit('intItemId from xml', intItemId)
								//Check whether item exist in the system
								var objItemSearch = search.create(
									{
										type: "item",
										filters: [
											["internalid", "anyof", intItemId]
										]
									}).run().getRange(0, 1);
								if (objItemSearch && objItemSearch.length > 0) {
									var id = objItemSearch[0].id;
									var lot = objData.batch_nbr;
									var quantity = objData.shipped_qty;
									var expiryDate = objData.expiry_date;
									var sqNum = lib.toInt(objData.seq_nbr)
									//var status = "Good";

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
														["inventorynumber", "is", lot]
													]
												}).run().getRange(0, 1);

											log.debug("lot: ", lot);

											if (objLotSearch && objLotSearch.length > 0) {

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
												strJSONMessage = "Lot " + lot + " is missing from NetSuite";
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

								if (objCopyItemInventoryDetails[intItemId]) {
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
									objItemFulfillment.removeCurrentSublistSubrecord(
										{
											sublistId: "item",
											fieldId: "inventorydetail"
										});
									var objInvDetailSubRec = objItemFulfillment.getCurrentSublistSubrecord(
										{
											sublistId: 'item',
											fieldId: 'inventorydetail'
										});
									//add new inventorydetail from the xml profile
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
							var intItemFulFillId = objItemFulfillment.save();

							if (lib.isNotNull(intItemFulFillId)) {
								log.audit('Item Fulfillment has been saved, id!', "Item Fulfillment Id : " + intItemFulFillId);

							}
							else {
								log.error("Failed To Item Fulfillment", 'Failed To Item Fulfillment');
								strJSONStatus = "Failed";
								strJSONMessage = 'Failed To Item Fulfillment';
							}
						}

						log.audit("Success", "Item Fulfillment Record created Successfully : " + intItemFulFillId);
						strJSONStatus = "Success";
						strJSONMessage = "Item Fulfillment Record created Successfully : " + intItemFulFillId;
					}
					else {
						log.error('VRA is missing', 'VENDOR RETURN AUTHORIZATION is missing in the System NS Account');
						strJSONStatus = "Failed"
						strJSONMessage = "VENDOR RETURN AUTHORIZATION  is missing in the System NS Account"

					}
				}
				else {
					log.error('VENDOR RETURN AUTHORIZATION  is missing', 'VENDOR RETURN AUTHORIZATION Id is missing');
					strJSONStatus = "Failed",
						strJSONMessage = "VENDOR RETURN AUTHORIZATION  Id is missing,Please pass the internalid"

				}
				var value = '<status>' + strJSONStatus + '</status> <message>' + strJSONMessage + '</message>';
				return value.toString();

			}
			catch (e) {
				log.error(
					{
						title: 'Error in doPost ' + intItemId,
						details: e.toString()
					});
				strJSONStatus = "Error"
				strJSONMessage = e.toString();
				var value = '<status>' + strJSONStatus + '</status> <message>' + strJSONMessage + '</message>';
				return value.toString();

			}
		}

		function createIFFromTOPicked(objJSON) {
			try {
				var _LOGGER_TITLE = '<<< Create IF from TO >>>';
				//var strJSONStatus = '';
				//var strJSONMessage = '';

				var arrInvtDetails = objJSON.ListOfShippedLoads.shipped_load.ob_stop;
				if (Array.isArray(arrInvtDetails)) arrInvtDetails = arrInvtDetails;
				else arrInvtDetails = [arrInvtDetails];
				log.debug('inventory details received from xml', JSON.stringify(arrInvtDetails));

				var intTOId = '';
				if (objJSON.ListOfShippedLoads && objJSON.ListOfShippedLoads.shipped_load && objJSON.ListOfShippedLoads.shipped_load.load && objJSON.ListOfShippedLoads.shipped_load.load.route_nbr)
					intTOId = objJSON.ListOfShippedLoads.shipped_load.load.route_nbr;
				else intTOId = arrInvtDetails[0].order_nbr;
				log.debug("inbound transfer order id: ", intTOId);

				if (lib.isNotNull(intTOId)) {
					//check if TO exists
					var objTOSearch = search.create(
						{
							type: "transferorder",
							filters: [
								'tranid', 'is', intTOId
							]
						}).run().getRange(0, 1);
					if (objTOSearch && objTOSearch.length > 0) {

						var toRecord = record.load({ type: 'transferorder', id: objTOSearch[0].id, isDynamic: false });
						for (var linetoRemove = 0; linetoRemove < toRecord.getLineCount({ sublistId: 'item' }); linetoRemove++) {
							toRecord.removeSublistSubrecord(
								{
									sublistId: "item",
									fieldId: "inventorydetail",
									line: linetoRemove
								});

						}
						toRecord.save();

						var intFoundToId = objTOSearch[0].id;
						//var k = 0;
						log.debug("transfer order found: ", intFoundToId);
						var objItemFulfillment = record.transform(
							{
								fromType: record.Type.TRANSFER_ORDER,
								toType: record.Type.ITEM_FULFILLMENT,
								fromId: intFoundToId,
								isDynamic: true
							});
						log.debug("transformed IF: ", objItemFulfillment);
						log.audit('ID of to', intFoundToId);
						//ship status = picked
						objItemFulfillment.setValue(
							{
								fieldId: 'shipstatus',
								value: 'C' // IT WAS A
							});
						var intItemLineCount = objItemFulfillment.getLineCount('item');
						log.debug("item line count: ", intItemLineCount);
						//retrieve inventory details from XML
						var objNewInvtDetails = {};

						/*
						var arrInvtDetails = objJSON.ListOfShippedLoads.shipped_load.ob_stop;
						if (Array.isArray(arrInvtDetails)) arrInvtDetails = arrInvtDetails;
						else arrInvtDetails = [arrInvtDetails];
						log.debug('inventory details received from xml', JSON.stringify(arrInvtDetails));
						*/

						//loop through inventory details array
						if (arrInvtDetails.length > 0) {
							arrInvtDetails.forEach(function (objElement) {
								var intItemId = objElement.order_dtl_cust_field_2;
								log.debug('item id from xml', intItemId);
								if (intItemId && lib.isNotNull(intItemId)) {
									//check if item exists
									var objItemSearch = search.create(
										{
											type: "item",
											filters: [
												["internalid", "is", intItemId]
											]
										}).run().getRange(0, 1);

									if (objItemSearch && objItemSearch.length > 0) {
										var id = objItemSearch[0].id;
										var lot = objElement.batch_nbr;
										var intQty = objElement.shipped_qty;
										var intSeqNbr = objElement.seq_nbr;
										var strStatus = 1;
										//item type
										var strType = objItemSearch[0].recordType;

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


														],
														columns: [
															search.createColumn({ name: "inventorynumber", label: "Item" })
														]
													}).run().getRange(0, 1);


												log.debug("~lot: " + lot + " and the looked up lot is " + objLotSearch[0].id);
												if (objLotSearch.length > 0)
													lot = objLotSearch[0].getValue('inventorynumber');
												log.debug('new lot is ' + lot)



												if (objLotSearch && objLotSearch.length > 0) {
													if (objNewInvtDetails[id]) {
														if (objNewInvtDetails[id][lot]) {
															objNewInvtDetails[id][lot].quantity += parseInt(intQty);
															objNewInvtDetails[id][lot].status = strStatus;
															objNewInvtDetails[id][lot].seqNbr = intSeqNbr;
														}
														else {
															objNewInvtDetails[id][lot] = {};
															objNewInvtDetails[id][lot].quantity = parseInt(intQty);
															objNewInvtDetails[id][lot].status = strStatus;
															objNewInvtDetails[id][lot].seqNbr = intSeqNbr;
														}
														objNewInvtDetails[id].quantity += parseInt(intQty);
													}
													else {
														objNewInvtDetails[id] = {};
														objNewInvtDetails[id][lot] = {};
														objNewInvtDetails[id].quantity = parseInt(intQty);
														objNewInvtDetails[id][lot].quantity = parseInt(intQty);
														objNewInvtDetails[id][lot].status = strStatus;
														objNewInvtDetails[id][lot].seqNbr = intSeqNbr;
													}
												}
												else {
													log.error("Lot is missing", "Lot is not present in NetSuite");
													strJSONStatus = "Failed";
													strJSONMessage = "Lot " + lot + " is missing from NetSuite";
												}
											}
											else {
												log.error("Lot is missing", "Lot is missing. Please make sure you include in the request.");
												strJSONStatus = "Failed";
												strJSONMessage = "Lot is missing. Please make sure you include in the request.";
											}
										}
										else if (strType == "inventoryitem") {
											if (objNewInvtDetails[id]) {
												objNewInvtDetails[id].quantity += parseInt(intQty);
												objNewInvtDetails[id].status = strStatus;
												objNewInvtDetails[id].seqNbr = intSeqNbr;
											}
											else {
												objNewInvtDetails[id] = {};
												objNewInvtDetails[id].quantity = parseInt(intQty);
												objNewInvtDetails[id].status = strStatus;
												objNewInvtDetails[id].seqNbr = intSeqNbr;
											}
										}
									}
									else {
										log.error("Item is missing", "Item is not present in NetSuite");
										strJSONStatus = "Failed";
										strJSONMessage = "Item " + intItemId + " is missing from NetSuite";
									}
								}
								else {
									log.error("Item Id is missing", "Item Id is missing. Please make sure you include in the request.");
									strJSONStatus = "Failed";
									strJSONMessage = "Item ID is missing. Please make sure you include in the request. ";
								}
							});



							log.debug("new inventory details: ", objNewInvtDetails);
							var toRemove = new Array();
							for (var intLine = 0; intLine < intItemLineCount; intLine++) {
								objItemFulfillment.selectLine(
									{
										sublistId: "item",
										line: intLine
									});

								var intItemId = objItemFulfillment.getSublistValue(
									{
										sublistId: "item",
										fieldId: "item",
										line: intLine
									});


								//log.audit('item ID bro',intItemId);
								if (objNewInvtDetails[intItemId]) {

									//log.debug("quantity: ",objNewInvtDetails[intItemId].quantity);

									objItemFulfillment.setCurrentSublistValue(
										{
											sublistId: "item",
											fieldId: "quantity",
											value: parseInt(objNewInvtDetails[intItemId].quantity)
										});

									/*	objItemFulfillment.setCurrentSublistValue(
										{
											sublistId: "item",
											fieldId: "totalquantity",
											value: parseInt(objNewInvtDetails[intItemId].quantity)
										});
	*/
									log.debug("IF object: ", objItemFulfillment);

									//remove existing inventorydetail from record transformation

									objItemFulfillment.removeCurrentSublistSubrecord(
										{
											sublistId: "item",
											fieldId: "inventorydetail"
										});

									var objInvDetailSubRec = objItemFulfillment.getCurrentSublistSubrecord(
										{
											sublistId: 'item',
											fieldId: 'inventorydetail'
										});

									log.debug("inventory details before inventory adding: ", objInvDetailSubRec);

									//add new inventory details from the xml profile

									//check item type
									var objItemSearch = search.create(
										{
											type: "item",
											filters: [
												["internalid", "is", intItemId]
											],
										}).run().getRange(0, 1);

									var strItemType = '';
									if (objItemSearch && objItemSearch.length > 0) strItemType = objItemSearch[0].recordType;
									var k = 0;

									if (strItemType == 'lotnumberedinventoryitem') {
										Object.keys(objNewInvtDetails[intItemId]).forEach(function (lot) {
											if (lot != "quantity" && objNewInvtDetails[intItemId][lot]) {
												log.debug("item for each:", intItemId);
												log.debug("lot for each: ", lot);
												log.debug("inventory for each: ", objNewInvtDetails[intItemId][lot]);
												log.audit('Line Count', objInvDetailSubRec.getLineCount('inventoryassignment'));


												//log.audit('ITEM DTL','qty:'+(objNewInvtDetails[intItemId][lot].quantity)+' | lot:'+lot+'| status:'+ objNewInvtDetails[intItemId][lot].status)
												objInvDetailSubRec.selectNewLine(
													{
														sublistId: 'inventoryassignment'
													});

												objInvDetailSubRec.setCurrentSublistValue(
													{
														sublistId: 'inventoryassignment',
														fieldId: 'quantity',
														value: (objNewInvtDetails[intItemId][lot].quantity)
													});



												objInvDetailSubRec.setCurrentSublistValue(
													{
														sublistId: 'inventoryassignment',
														fieldId: 'receiptinventorynumber',
														value: lot
													});




												objInvDetailSubRec.setCurrentSublistValue(
													{
														sublistId: 'inventoryassignment',
														fieldId: 'inventorystatus',
														value: objNewInvtDetails[intItemId][lot].status
													});

												log.debug("inventory details after inventory adding: ", objInvDetailSubRec);

												//commit inventorydetail sublist
												objInvDetailSubRec.commitLine(
													{
														sublistId: "inventoryassignment"
													});
											}
										});
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
												value: objNewInvtDetails[intItemId].quantity
											});

										objInvDetailSubRec.setCurrentSublistValue(
											{
												sublistId: 'inventoryassignment',
												fieldId: 'itemquantity',
												value: objNewInvtDetails[intItemId].quantity
											});

										objInvDetailSubRec.setCurrentSublistValue(
											{
												sublistId: 'inventoryassignment',
												fieldId: 'inventorystatus',
												value: objNewInvtDetails[intItemId].status
											});

										log.debug("inventory details after inventory adding: ", objInvDetailSubRec);
										//commit inventorydetail sublist
										objInvDetailSubRec.commitLine(
											{
												sublistId: "inventoryassignment",
												ignoreRecalc: false
											});
									}

									//mark fulfill checkbox
									/*
									objItemFulfillment.setCurrentSublistValue({
										sublistId: 'item',
										fieldId: 'itemreceive',
										value: true
									});
									*/
									if (k == 0 && strItemType == "inventoryitem") {
										//log.debug('removing first line ');
										objInvDetailSubRec.removeLine(
											{
												sublistId: 'inventoryassignment',
												line: 0
											});
										k++;
										//log.debug("After removal subrec ",objInvDetailSubRec);
									}
									//log.debug("inventory details before commit: ",objInvDetailSubRec);
									//commit line
									objItemFulfillment.commitLine(
										{
											sublistId: "item"
										});
								}
								else {
									log.error('THEEEEEEEEE ITEM DOES NOT EXIST ', intItemId)
									toRemove.push(intLine);
								}
							}
							if (strJSONStatus == '') {
								log.debug("no error occurred so far");
								for (var tr = toRemove.length - 1; tr >= 0; tr--) {

									log.error("To remove line " + toRemove[tr])

									objItemFulfillment.selectLine(
										{
											sublistId: "item",
											line: toRemove[tr]
										});

									objItemFulfillment.setCurrentSublistValue(
										{
											sublistId: "item",
											fieldId: 'itemreceive',
											value: false
										});

									objItemFulfillment.commitLine(
										{
											sublistId: "item"
										});


									/*    objItemFulfillment.removeLine(
												{
													sublistId: 'item',
													line: toRemove[tr]
												});
												*/
								}


								var intItemFulfillId = objItemFulfillment.save();
								log.debug("item fulfillment saved: ", intItemFulfillId);
								strJSONStatus = "Success";
								strJSONMessage = "Item fulfillment successfully created: " + intItemFulfillId;
							}
						}
					}
					else {
						log.error("Transfer Order is missing", "Transfer Order Id is not present in NetSuite");
						strJSONStatus = "Failed";
						strJSONMessage = "Transfer Order Id " + intTOId + " is missing from NetSuite";
					}
				}
				else {
					log.error("Transfer Order is missing", "Transfer Order Id is missing");
					strJSONStatus = "Failed";
					strJSONMessage = "Transfer Order Id is missing. Please make sure you include it in the request.";
				}

				return JSON.stringify(
					{
						"status": strJSONStatus,
						"message": strJSONMessage
					});
			}
			catch (error) {
				log.error(_LOGGER_TITLE, JSON.stringify(error));
				return JSON.stringify(
					{
						"status": "Failed",
						"message": "item: " + intItemId + " " + error.message
					});
			}
		}
		return {
			post: doPost
		};

	});