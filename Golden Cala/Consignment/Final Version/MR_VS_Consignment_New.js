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
    
            // Gather unique item IDs from dataMap
            var uniqueItemIds = Array.from(new Set(consolidatedData.map(record => record['Item ID'])));
    
            // Perform search for available lots based on location and items
            var inventorynumberSearchObj = search.create({
                type: "inventorynumber",
                filters: [
                    ["location", "anyof", locationId],
                    "AND",
                    ["quantityonhand", "greaterthan", "0"],
                    "AND",
                    ["item", "anyof"].concat(uniqueItemIds),
                    "AND", 
                    [["expirationdate","after","today"],"OR",["expirationdate","isempty",""]]              

                ],
                columns: [
                    search.createColumn({ name: "inventorynumber", label: "Number" }),
                    search.createColumn({ name: "quantityavailable", label: "Available" }),
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "internalid", join: "item", label: "Internal ID" })
                ]
            });
    
            var searchResults = [];
            inventorynumberSearchObj.run().each(function (result) {
                searchResults.push({
                    lotNumber: result.getValue({ name: "inventorynumber" }),
                    quantityAvailable: parseFloat(result.getValue({ name: "quantityavailable" })) || 0,
                    internalId: result.getValue({ name: "internalid" }),
                    itemInternalId: result.getValue({ name: "internalid", join: "item" })
                });
                return true;
            });
    
            // Allocate lots to each record in consolidatedData
            var lotUsage = {}; // To track remaining quantities in lots
            var inputData = consolidatedData.map(record => {
                var remainingQty = record['# Units'];
                var itemId = record['Item ID'];
    
                // Filter lots belonging to this item
                var lotsForItem = searchResults.filter(lot => lot.itemInternalId === itemId);
    
                var allocatedLots = [];
                for (var lot of lotsForItem) {
                    if (remainingQty <= 0) break;
    
                    // Get remaining quantity for the lot
                    var availableQty = lotUsage[lot.internalId] !== undefined
                        ? lotUsage[lot.internalId]
                        : lot.quantityAvailable;
    
                    if (availableQty > 0) {
                        var qtyToDeduct = Math.min(remainingQty, availableQty);
    
                        allocatedLots.push({
                            lotNumber: lot.internalId, // Use internal ID of the lot
                            quantity: qtyToDeduct
                        });
    
                        // Update lot usage
                        lotUsage[lot.internalId] = availableQty - qtyToDeduct;
                        remainingQty -= qtyToDeduct;
    
                        // Exclude lot if fully used
                        if (lotUsage[lot.internalId] <= 0) {
                            lotUsage[lot.internalId] = 0;
                        }
                    }
                }
    
                if (remainingQty > 0) {
                    throw new Error(`Insufficient lot quantities for item ${itemId} and store code ${record['Store Code']}`);
                }
    
                return {
                    record: {
                        ...record,
                        lotDetails: allocatedLots // Only send needed lots for each item
                    }
                };
            });
    
            return inputData; // Return prepared input data for map stage
        } catch (error) {
            log.error('ERROR in getInputData Stage', error);
        }
    }   
    
    function map(context) {
        try {
            // Log each line with all its details
            log.debug('Map Stage - Line Data', JSON.stringify(JSON.parse(context.value)));
    
            // Pass data to the reduce stage
            context.write({ key: '1', value: context.value });
        } catch (error) {
            log.error('ERROR in map Stage', error);
        }
    }
    
    function reduce(context) {
        try {
            // logUsage(context, 'reduce start ');
    
            var itemData = context.values.map(JSON.parse); // Parse input data
            var firstEntry = itemData[0];
            var customerId = firstEntry.record.customerId;
            var logFileID = firstEntry.record.logFileID; // Retrieve logFileID
            var fileName = firstEntry.record.fileName;
            var dateParam = firstEntry.record.dateParam;
    
            if (!logFileID) {
                log.error('Missing logFileID', 'Cannot append to log file because logFileID is undefined.');
                throw new Error('logFileID is missing in reduce stage.');
            }
    
            var customerLocation = firstEntry.record.locationId;
    
            var invoiceRecord = record.create({ type: record.Type.INVOICE, isDynamic: true });
            // var invoiceRecord = record.create({ type: record.Type.SALES_ORDER, isDynamic: true });
    
            invoiceRecord.setValue({ fieldId: 'entity', value: customerId });
            var parsedDate = format.parse({ value: dateParam, type: format.Type.DATE });
            invoiceRecord.setValue({ fieldId: 'trandate', value: parsedDate });
            invoiceRecord.setValue({ fieldId: 'location', value: customerLocation });
            invoiceRecord.setValue({ fieldId: 'custbody_vs_consignment_source', value: fileName });
    
            // Add all lines and log each line's data
            itemData.forEach(function (entry) {
                if (entry.record.lotDetails && entry.record.lotDetails.length > 0) {
                    addInvoiceLineWithInventoryDetails(context, invoiceRecord, entry.record['Item ID'], entry.record.lotDetails, entry.record['Store Code'], entry.record.logFileID);
                } else {
                    log.error('Missing lotDetails', `Item ID: ${entry.record['Item ID']} does not have lot details.`);
                    throw new Error(`Missing lot details for Item ID: ${entry.record['Item ID']}`);
                }
    
                // Log grouped data for the line
                var logData = {
                    itemId: entry.record['Item ID'],
                    quantity: entry.record['# Units'],
                    storeCode: entry.record['Store Code'],
                    lotDetails: entry.record.lotDetails
                };
                log.debug('Invoice Line Data', logData);
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
    
    function addInvoiceLineWithInventoryDetails(context, invoiceRecord, itemId, lotDetails, storeCode, logFileID) {
        try {
            invoiceRecord.selectNewLine({ sublistId: 'item' });
            invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemId });
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
    
    function appendToLogFile(logFileID, message) {
        try {
            if (!logFileID) {
                log.error('Missing logFileID', 'Cannot append to log file because logFileID is undefined.');
                return; // Exit if logFileID is invalid
            }
    
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
    

    return {
        getInputData,
        map,
        reduce
    };
});
