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

								objTransfer.setValue({ fieldId: 'customform', value: 181 });
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