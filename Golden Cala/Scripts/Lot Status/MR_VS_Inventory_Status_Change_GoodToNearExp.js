/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/runtime', 'N/log'], function (record, search, runtime, log) {
    function getInputData() {
        try {
          log.debug('Script Started: ', 'Start');
            var searchObj = search.create({
                type: "inventorybalance",
                filters:
                    [
                        ["item.isinactive", "is", "F"],
                        "AND",
                        ["status", "anyof", "1"], // Good item
                        "AND",
                        ["available", "greaterthan", "0"],
                        "AND",
                        ["formulatext: CASE WHEN {inventorynumber.expirationdate} - {today} <= 150  and {inventorynumber.expirationdate} - {today}  >=0 THEN 'T' ELSE 'F' END", "is", "T"],
                        // "AND",
                        // ["item", "anyof", "1712"]
                    ],
                columns:
                    [
                        search.createColumn({ name: "item", label: "Item" }),
                        search.createColumn({ name: "location", label: "Location" }),
                        search.createColumn({ name: "inventorynumber", label: "Inventory Number" }),
                        search.createColumn({ name: "expirationdate", join: "inventoryNumber", label: "Expiration Date" }),
                        search.createColumn({ name: "status", label: "Status" }),
                        search.createColumn({ name: "available", label: "Available" }),
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

            var loggedData = {
                locationId: locationId,
                itemId: itemId,
                quantity: available,
                lotID: internalId
            };

            log.debug('Map Data: ', loggedData);

            var processedData = {
                item: itemId,
                available: available,
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
            statusChangeRecord.setValue({ fieldId: 'revisedstatus', value: 2 }); // Near Expire

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
