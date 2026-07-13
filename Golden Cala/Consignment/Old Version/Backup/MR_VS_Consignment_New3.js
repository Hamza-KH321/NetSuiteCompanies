/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/file', 'N/search', 'N/runtime', 'N/format'], function (record, file, search, runtime, format) {
    var lotUsage = {};
    var excludedLots = [];

    function getInputData(context) {
        try {
            var fileId = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_cons_file_id_new1' });
            var customerId = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_customer_id1' });
            var fileName = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_cons_file_name1' });
            var logFileID = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_log_file_id1' });
            var locationId = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_location_id' });
            var dateParam = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_date1' });

            if (!fileId || !customerId || !locationId) {
                throw new Error('File ID, Customer ID, or Location ID is missing. Please check the Suitelet script.');
            }

            // Load and read the uploaded CSV file
            var uploadedFile = file.load({ id: fileId });
            var fileContent = uploadedFile.getContents();
            var lines = fileContent.split('\n');
            
            // Extract headers and prepare a map for summing data
            var headers = lines[0].split(',').map(header => header.trim());
            var dataMap = {};

            // Process each line of the CSV (skip header row)
            for (var i = 1; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue; // Skip empty lines

                var values = line.split(',').map(value => value.trim());
                var row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index];
                });

                var key = `${row['Item ID']}_${row['Store Code']}`;
                var units = parseFloat(row['# Units']) || 0;

                // Sum # Units for duplicate Item ID and Store Code
                if (dataMap[key]) {
                    dataMap[key]['# Units'] += units;
                } else {
                    dataMap[key] = {
                        'Item ID': row['Item ID'],
                        'Store Code': row['Store Code'],
                        '# Units': units,
                        customerId: customerId,
                        fileName: fileName,
                        logFileID: logFileID,
                        locationId: locationId,
                        dateParam: dateParam
                    };
                }
            }

            // Convert dataMap to an array of unique records
            var consolidatedData = Object.values(dataMap);

            // log.debug('consolidatedData' , consolidatedData);

            return consolidatedData;

        } catch (error) {
            log.error('ERROR in getInputData Stage', error);
        }
    }

    function map(context) {
        try {
            var data = JSON.parse(context.value);

            var itemId = data['Item ID'];
            var storeCode = data['Store Code'];
            var quantity = parseFloat(data['# Units']);
            var customerId = data.customerId;
            var customerLocation = data.locationId;
            var fileName = data.fileName;
            var logFileID = data.logFileID;
            var dateParam = data.dateParam;

            var isValid = true;
            var message = '';

            // Check if item is lot-numbered and get available lot details
            var isLotNumbered = checkIfLotNumbered(itemId);
            var lotDetails = [];
            if (isLotNumbered) {
                lotDetails = getLotDetails(itemId, quantity, customerLocation);
                var totalAvailableQty = lotDetails.reduce(function (sum, lot) {
                    return sum + lot.quantity;
                }, 0);
                if (totalAvailableQty < quantity) {
                    message = `Not enough quantity for item ${itemId}. Requested: ${quantity}, Available: ${totalAvailableQty}.`;
                    log.error('Not Enough Quantity', message);
                    appendToLogFile(logFileID, message);
                    isValid = false;
                }
            }

            // Log all data for this line
            var lineData = {
                itemId: itemId,
                storeCode: storeCode,
                quantity: quantity,
                customerId: customerId,
                customerLocation: customerLocation,
                isLotNumbered: isLotNumbered,
                lotDetails: lotDetails,
                isValid: isValid,
                fileName: fileName,
                logFileID: logFileID,
                dateParam: dateParam
            };
            // log.debug('Processed Line Data (Map)', lineData);
            // appendToLogFile(logFileID, `Processed Line: ${JSON.stringify(lineData)}`);

            context.write({
                key: '1',
                value: JSON.stringify(lineData)
            });
        } catch (error) {
            log.error('ERROR in map Stage', error);
        }
    }

    function reduce(context) {
        try {
            var itemData = context.values.map(JSON.parse);
            var firstEntry = itemData[0];
            var customerId = firstEntry.customerId;
            var fileName = firstEntry.fileName;
            var logFileID = firstEntry.logFileID;
            var dateParam = firstEntry.dateParam;

            if (!customerId) {
                var message = `Customer is invalid or missing for entry: ${JSON.stringify(firstEntry)}`;
                log.error('Invalid Customer', message);
                appendToLogFile(logFileID, message);
                throw new Error(message);
            }

            var hasInvalidLine = itemData.some(function (entry) {
                return !entry.isValid;
            });

            if (hasInvalidLine) {
                var message = `Invoice creation aborted. Some lines have invalid store codes or insufficient quantity.`;
                log.error('Invoice Aborted', message);
                appendToLogFile(logFileID, message);
                return;
            }

            var customerLocation = firstEntry.customerLocation;

            // var invoiceRecord = record.create({ type: record.Type.INVOICE, isDynamic: true });
            var invoiceRecord = record.create({ type: record.Type.SALES_ORDER, isDynamic: true });

            invoiceRecord.setValue({ fieldId: 'entity', value: customerId });
            var parsedDate = format.parse({value: dateParam,type: format.Type.DATE});
            invoiceRecord.setValue({ fieldId: 'trandate', value: parsedDate });
            invoiceRecord.setValue({ fieldId: 'location', value: customerLocation });
            invoiceRecord.setValue({ fieldId: 'custbody_vs_consignment_source', value: fileName });



            // Add all lines and log each line's data
            itemData.forEach(function (entry) {
                if (entry.isLotNumbered) {
                    addInvoiceLineWithInventoryDetails(invoiceRecord, entry.itemId, entry.lotDetails, entry.itemDescription, entry.storeCode, entry.logFileID);
                } else {
                    addInvoiceLineWithoutInventoryDetails(invoiceRecord, entry.itemId, entry.quantity, entry.itemDescription, entry.storeCode);
                }

                // Log grouped data for the line
                var logData = {
                    itemId: entry.itemId,
                    quantity: entry.quantity,
                    description: entry.itemDescription,
                    storeCode: entry.storeCode,
                    isLotNumbered: entry.isLotNumbered,
                    lotDetails: entry.lotDetails
                };
                log.debug('Invoice Line Data', logData);
                // appendToLogFile(entry.logFileID, `Invoice Line: ${JSON.stringify(logData)}`);
            });

            var invoiceId = invoiceRecord.save();
            log.debug('Invoice Created', `Invoice ID: ${invoiceId}`);
            appendToLogFile(logFileID, `Invoice Created with ID: ${invoiceId}`);
        } catch (error) {
            log.error('ERROR in reduce Stage', error);
            appendToLogFile(logFileID, `Error in Reduce Stage: ${error.message}`);
            throw error;
        }
    }

    function addInvoiceLineWithInventoryDetails(invoiceRecord, itemId, lotDetails, description, storeCode, logFileID) {
        try {
            invoiceRecord.selectNewLine({ sublistId: 'item' });
            invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemId });
            invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: description });
            invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_storecode', value: storeCode });
    
            var totalQuantity = lotDetails.reduce((sum, lot) => sum + lot.quantity, 0);
            invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: totalQuantity });
    
            var inventoryDetail = invoiceRecord.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });
            lotDetails.forEach(lot => {
                if (lot.quantity > 0) {
                    inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });
                    inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: lot.lotNumber });
                    inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: lot.quantity });
                    inventoryDetail.commitLine({ sublistId: 'inventoryassignment' });
                } else {
                    appendToLogFile(logFileID, `Lot ${lot.lotNumber} for item ${itemId} has no available quantity.`);
                    log.error('Lot Assignment Error', `Lot ${lot.lotNumber} for item ${itemId} has no available quantity.`);
                }
            });
    
            invoiceRecord.commitLine({ sublistId: 'item' });
        } catch (error) {
            appendToLogFile(logFileID, `Error processing item ${itemId} with Store Code: ${storeCode}. Error: ${error.message}`);
            throw error;
        }
    }
    

    function addInvoiceLineWithoutInventoryDetails(invoiceRecord, itemId, quantity, description, storeCode) {
        invoiceRecord.selectNewLine({ sublistId: 'item' });
        invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemId });
        invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: quantity });
        invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: description });
        invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_storecode', value: storeCode });
        invoiceRecord.commitLine({ sublistId: 'item' });
    }

    function checkIfLotNumbered(itemId) {
        var itemTypeSearch = search.lookupFields({
            type: search.Type.ITEM,
            id: itemId,
            columns: ['islotitem', 'isserialitem']
        });
        return itemTypeSearch.islotitem || itemTypeSearch.isserialitem;
    }

function getLotDetails(itemId, requiredQuantity, customerLocation) {
    var remainingQty = requiredQuantity;
    var allocatedLots = [];

    var filters = [
        ["item.internalid", "anyof", itemId],
        "AND",
        ["location", "anyof", customerLocation],
        "AND",
        ["quantityonhand", "greaterthan", "0"]
    ];

    // Exclude fully consumed lots
    if (excludedLots.length > 0) {
        filters.push("AND");
        filters.push(["internalid", "noneof"].concat(excludedLots));
    }

    // Search for available lots
    var inventorySearch = search.create({
        type: "inventorynumber",
        filters: filters,
        columns: [
            search.createColumn({ name: "inventorynumber", label: "Number" }),
            search.createColumn({ name: "quantityavailable", label: "Available" }),
            search.createColumn({ name: "internalid", label: "Internal ID" })
        ]
    });

    inventorySearch.run().each((result) => {
        var lotNumberId = result.getValue({ name: "internalid" });
        var availableQty = parseFloat(result.getValue({ name: "quantityavailable" })) || 0;

        // Deduct previously used quantity
        var usedQty = lotUsage[lotNumberId] || 0;
        availableQty -= usedQty;

        if (availableQty > 0 && remainingQty > 0) {
            var allocatedQty = Math.min(remainingQty, availableQty);
            allocatedLots.push({ lotNumber: lotNumberId, quantity: allocatedQty });

            // Update usage and remaining quantities
            lotUsage[lotNumberId] = (lotUsage[lotNumberId] || 0) + allocatedQty;
            remainingQty -= allocatedQty;

            // Mark fully consumed lots for exclusion
            if (availableQty === allocatedQty) {
                excludedLots.push(lotNumberId);
            }
        }

        return remainingQty > 0; // Stop if fully allocated
    });

    if (remainingQty > 0) {
        throw new Error(`Insufficient lot availability for item ${itemId}. Required: ${requiredQuantity}, Remaining: ${remainingQty}.`);
    }

    return allocatedLots;
}
    
    function appendToLogFile(logFileID, message) {
        try {
            var logFile = file.load({ id: logFileID });
            var fileContent = logFile.getContents();
            fileContent += `\n${message}`;
            var newFile = file.create({
                name: logFile.name,
                fileType: file.Type.PLAINTEXT,
                contents: fileContent,
                folder: logFile.folder
            });
            newFile.save();
        } catch (error) {
            log.error('Error appending to log file', error);
        }
    }

    return { getInputData, 
         map,
         reduce 
    };
});
