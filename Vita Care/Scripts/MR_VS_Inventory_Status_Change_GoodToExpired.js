/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Inv Stat Change Good to Expired
 */
define(['N/record', 'N/search', 'N/runtime', 'N/log'], function (record, search, runtime, log) {

    function getInputData() {
        try {
            log.debug('Script Starts', 'Checking');

            var searchObj = search.create({
                type: "inventorybalance",
                filters: [
                    ["item.isinactive", "is", "F"],
                    // "AND",
                    // ["inventorynumber.expirationdate", "onorbefore", "today"],
                    "AND",
                    ["status", "anyof", "1"], // From Good to Expired
                    "AND",
                    ["available", "greaterthan", "0"],
                    "AND",
                    ["formulatext: case when FLOOR({inventorynumber.expirationdate} - {today}) <= 90 then 'T' else 'F' END", "is", "T"],
                    // "AND",
                    // ["formulatext: {item.class}", "doesnotstartwith", "Animal"],
                    "AND",
                    ["formulatext: CASE WHEN {location} = {inventorynumber.location} then 'T' ELSE 'F' END", "is", "T"],
                    "AND",
                    ["formulatext: {item.class}", "startswith", "Medical"]


                    // "AND",
                    // ["item", "anyof", "1170", "1061", "2242", "3335"],

                ],
                columns: [
                    search.createColumn({ name: "item" }),
                    search.createColumn({ name: "location" }),
                    search.createColumn({ name: "inventorynumber" }),
                    search.createColumn({ name: "status" }),
                    search.createColumn({ name: "available" }),
                    search.createColumn({ name: "quantityonorder", join: "inventoryNumber", label: "On Order" }),
                    search.createColumn({ name: "internalid", join: "inventoryNumber", label: "Internal ID" }),
                ]
            });

            var searchResults = [];
            searchObj.run().each(function (result) {
                searchResults.push({
                    item: result.getValue({ name: "item" }),
                    location: result.getValue({ name: "location" }),
                    inventoryNumber: result.getValue({ name: "inventorynumber" }),
                    status: result.getValue({ name: "status" }),
                    available: result.getValue({ name: "available" }),
                    quantityOnOrder: result.getValue({ name: "quantityonorder", join: "inventoryNumber" }),
                    internalId: result.getValue({ name: "internalid", join: "inventoryNumber" })
                });
                return true;
            });

            return searchObj;

        } catch (error) {
            log.error({ title: 'Error in getInputData', details: error });
        }
    }

    function map(context) {
        try {
            var result = JSON.parse(context.value);

            var locationId = result.values.location.value;
            var itemId = result.values.item.value;
            var available = result.values.available;
            var quantityOnOrder = result.values["quantityonorder.inventoryNumber"];
            var internalId = result.values["internalid.inventoryNumber"].value;

            var loggedData = {
                locationId: locationId,
                itemId: itemId,
                quantity: available,
                quantityOnOrder: quantityOnOrder,
                lotID: internalId,
            };

            log.debug('Map Data: ', loggedData);

            var processedData = {
                item: itemId,
                available: available,
                quantityOnOrder: quantityOnOrder,
                internalId: internalId
            };

            context.write({ key: locationId, value: processedData });

        } catch (error) {
            log.error({ title: 'Error in map function', details: error });
        }
    }

    function reduce(context) {
        try {
            var locationId = context.key;
            var inventoryDetails = context.values.map(JSON.parse);

            if (inventoryDetails.length === 0) {
                return;
            }

            var statusChangeRecord = record.create({
                type: record.Type.INVENTORY_STATUS_CHANGE,
                isDynamic: true
            });

            statusChangeRecord.setValue({ fieldId: 'location', value: locationId });
            statusChangeRecord.setValue({ fieldId: 'revisedstatus', value: 5 }); //expired

            inventoryDetails.forEach(function (detail) {

                if (!detail.item || !detail.available || !detail.internalId) {
                    log.error({
                        title: 'Missing Required Fields',
                        details: 'Item: ' + detail.item + ', Available: ' + detail.available + ', Internal ID: ' + detail.internalId
                    });
                    return;
                }

                var finalQty = parseFloat(detail.available) - parseFloat(detail.quantityOnOrder || 0);

                log.debug('Final Quantity Calculation', {
                    itemL: detail.item,
                    available: detail.available,
                    quantityOnOrder: detail.quantityOnOrder,
                    finalQty: finalQty
                });

                statusChangeRecord.selectNewLine({ sublistId: 'inventory' });
                statusChangeRecord.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'item', value: detail.item });

                statusChangeRecord.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'quantity', value: finalQty });

                var subrecord = statusChangeRecord.getCurrentSublistSubrecord({
                    sublistId: 'inventory',
                    fieldId: 'inventorydetail'
                });

                if (subrecord) {
                    subrecord.selectNewLine({ sublistId: 'inventoryassignment' });

                    subrecord.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: detail.internalId });
                    subrecord.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: finalQty });

                    subrecord.commitLine({ sublistId: 'inventoryassignment' });

                } else {
                    log.error({
                        title: 'Inventory Detail Subrecord Not Created',
                        details: 'Item ID: ' + detail.item + ', Location: ' + locationId
                    });
                }

                statusChangeRecord.commitLine({ sublistId: 'inventory' });

            });

            var recordId = statusChangeRecord.save();
            log.audit({ title: 'Inventory Status Change Created', details: 'Record ID: ' + recordId });

        } catch (error) {
            log.error({ title: 'Error in reduce function', details: error });
        }
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce
    };

});
