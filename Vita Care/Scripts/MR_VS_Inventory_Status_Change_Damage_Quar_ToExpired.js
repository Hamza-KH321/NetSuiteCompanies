/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/runtime', 'N/log'], function (record, search, runtime, log) {
    function getInputData() {
        try {
            log.debug('Script Starts', 'Checking');
            var searchObj = search.create({
                type: "inventorybalance",
                filters: [
                    ["status", "anyof", "2"], // Quarantine (3) and Damage (2) to Expired
                    "AND",
                    ["item.isinactive", "is", "F"],
                    "AND",
                    ["formulatext: case when FLOOR({inventorynumber.expirationdate} - {today}) <= 90 then 'T' else 'F' END", "is", "T"]
                ],
                columns: [
                    search.createColumn({ name: "item" }),
                    search.createColumn({ name: "location" }),
                    search.createColumn({ name: "inventorynumber" }),
                    search.createColumn({ name: "status" }),
                    search.createColumn({ name: "available" }),
                    search.createColumn({ name: "internalid", join: "inventoryNumber", label: "Internal ID" })
                ]
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
            var internalId = result.values["internalid.inventoryNumber"].value;
            var statusId = result.values.status.value; // Capture previousstatus

            var loggedData = {
                locationId: locationId,
                itemId: itemId,
                quantity: available,
                lotID: internalId,
                previousStatus: statusId
            }

            log.debug('Map Data: ', loggedData);

            var processedData = {
                item: itemId,
                available: available,
                internalId: internalId,
                previousStatus: statusId
            };

            // Key = Location + PreviousStatus
            context.write({ key: locationId + '|' + statusId, value: processedData });

        } catch (error) {
            log.error({ title: 'Error in map function', details: error });
        }
    }

    function reduce(context) {
        try {
            var keyParts = context.key.split('|');
            var locationId = keyParts[0];
            var previousStatus = keyParts[1]; // Always 2 (Damage) or 3 (Quarantine)

            var inventoryDetails = context.values.map(JSON.parse);

            if (inventoryDetails.length === 0) {
                return;
            }

            var statusChangeRecord = record.create({
                type: record.Type.INVENTORY_STATUS_CHANGE,
                isDynamic: true
            });

            statusChangeRecord.setValue({ fieldId: 'location', value: locationId });
            statusChangeRecord.setValue({ fieldId: 'revisedstatus', value: 5 }); // Expired
            statusChangeRecord.setValue({ fieldId: 'previousstatus', value: previousStatus }); // Must be 2 or 3

            inventoryDetails.forEach(function (detail) {
                if (!detail.item || !detail.available || !detail.internalId) {
                    log.error({
                        title: 'Missing Required Fields',
                        details: 'Item: ' + detail.item + ', Available: ' + detail.available + ', Internal ID: ' + detail.internalId
                    });
                    return;
                }

                statusChangeRecord.selectNewLine({ sublistId: 'inventory' });
                statusChangeRecord.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'item', value: detail.item });
                statusChangeRecord.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'quantity', value: detail.available });

                var subrecord = statusChangeRecord.getCurrentSublistSubrecord({ sublistId: 'inventory', fieldId: 'inventorydetail' });
                if (subrecord) {
                    subrecord.selectNewLine({ sublistId: 'inventoryassignment' });

                    subrecord.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: detail.internalId });
                    subrecord.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: detail.available });

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
            log.audit({ title: 'Inventory Status Change Created', details: 'Record ID: ' + recordId + ', PreviousStatus: ' + previousStatus });
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
