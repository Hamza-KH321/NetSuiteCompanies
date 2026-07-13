/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/file', 'N/search', 'N/runtime', 'N/format'], function(record, file, search, runtime, format) {

    function getInputData(context) {
        try {
            var fileId = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_cons_file_id' });
            var customerId = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_customer_id' });
            var fileName = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_cons_file_name' });
            var logFileID = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_log_file_id' });

            if (!fileId || !customerId) {
                throw new Error('File ID or Customer ID is missing. Please check the Suitelet script.');
            }

            var uploadedFile = file.load({ id: fileId });
            var fileContent = uploadedFile.getContents();
            var lines = fileContent.split('\n');
            var headers = lines[0].split(',');

            var data = [];

            for (var i = 1; i < lines.length; i++) {
                var line = lines[i].split(',');
                if (line.length === headers.length) {
                    var row = {};
                    for (var j = 0; j < headers.length; j++) {
                        row[headers[j].trim()] = line[j].trim();
                    }
                    data.push(row);
                }
            }

            // Add the customerID from the Suitelet to each data row
            data.forEach(function(row) { row.customerId = customerId; });
            data.forEach(function(row) { row.fileName = fileName; });
            data.forEach(function(row) { row.logFileID = logFileID; });

            var customerRecord = record.load({ type: record.Type.CUSTOMER, id: customerId });
            var customerLocation = customerRecord.getValue({ fieldId: 'custentity_vs_cons_location_customer' });

            // Add the customerLocation from the Suitelet to each data row
            data.forEach(function(row) { row.customerLocation = customerLocation; });

            return data;

        } catch (error) {
            log.error('ERROR in getInputData Stage ', error);
        }
    }

    function map(context) {
        try {
            var data = JSON.parse(context.value);

            var itemId = data['Item ID'];
            var storeCode = data['Store Code'];
            var quantity = parseFloat(data['# Units']);
            //var amount = parseFloat(data['$ Revenue']);
            var customerId = data.customerId;
            var date = data['Month'];
            var customerLocation = data.customerLocation;
            var fileName = data.fileName;
            var logFileID = data.logFileID;

            // Initialize flags for validation
            var isValid = true;
            var message = '';

            // Validate store code
            var storeCodeValid = checkStoreCode(storeCode, customerId);
            if (!storeCodeValid) {
                message = `Invalid store code (${storeCode}) for item ${itemId}.`;
                log.error('Invalid Store Code', message);
                appendToLogFile(logFileID, message);
                isValid = false;
            }

            // Check if item is lot-numbered and get available lot details
            var isLotNumbered = checkIfLotNumbered(itemId);
            var lotDetails = [];
            if (isLotNumbered) {
                lotDetails = getLotDetails(itemId, quantity, customerLocation);

                // Check if the available lot quantity is enough
                var totalAvailableQty = lotDetails.reduce(function(sum, lot) { return sum + lot.quantity; }, 0);
                if (totalAvailableQty < quantity) {
                    message = `Not enough quantity for item ${itemId}. Requested: ${quantity}, Available: ${totalAvailableQty}.`;
                    log.error('Not Enough Quantity', message);
                    appendToLogFile(logFileID, message);
                    isValid = false;
                }
            }

            // Write aggregated data for reduce
            context.write({
                key: '1', // Single key to ensure all data goes to the same reduce stage
                value: JSON.stringify({
                    itemId: itemId,
                    storeCode: storeCode,
                    quantity: quantity,
                    itemDescription: data['Item Descreption'],
                    //amount: amount,
                    customerId: customerId,
                    date: date,
                    customerLocation: customerLocation,
                    storeCodeValid: storeCodeValid,
                    isLotNumbered: isLotNumbered, // Pass flag
                    lotDetails: lotDetails, // Pass lot details for each item
                    isValid: isValid, // Flag to indicate if the line is valid
                    fileName: fileName,
                    logFileID: logFileID
                })
            });
        } catch (error) {
            var logFileID = JSON.parse(context.value).logFileID;
            log.error('ERROR in map Stage ', error);
            appendToLogFile(logFileID, `ERROR in map Stage: ${error.message}`);
        }
    }

    function reduce(context) {
        try {
            var itemData = context.values.map(JSON.parse);
            var firstEntry = itemData[0];
            var customerId = firstEntry.customerId;
            var fileName = firstEntry.fileName;
            var logFileID = firstEntry.logFileID;

            if (!customerId) {
                var message = `Customer is invalid or missing for entry: ${JSON.stringify(firstEntry)}`;
                log.error('Invalid Customer', message);
                appendToLogFile(logFileID, message);
                throw new Error(message);
            }

            // Check if any line is invalid (due to store code or quantity)
            var hasInvalidLine = itemData.some(function(entry) {
                return !entry.isValid;
            });

            if (hasInvalidLine) {
                var message = `Invoice creation aborted. Some lines have invalid store codes or insufficient quantity.`;
                log.error('Invoice Aborted', message);
                appendToLogFile(logFileID, message);
                return; // Abort invoice creation
            }

            // Continue with invoice creation if all data is valid
            var customerLocation = firstEntry.customerLocation;

            // Create the invoice
            var invoiceRecord = record.create({ type: record.Type.INVOICE, isDynamic: true });
            invoiceRecord.setValue({ fieldId: 'entity', value: customerId });
            invoiceRecord.setValue({ fieldId: 'location', value: customerLocation });
            invoiceRecord.setValue({ fieldId: 'custbody_vs_consignment_source', value: fileName });

            if (firstEntry.date) {
                var parsedDate = format.parse({ value: firstEntry.date, type: format.Type.DATE });
                invoiceRecord.setValue({ fieldId: 'trandate', value: parsedDate });
            } else {
                invoiceRecord.setValue({ fieldId: 'trandate', value: new Date() });
            }

            // Add aggregated lines to the invoice
            itemData.forEach(function(entry) {
                if (entry.isLotNumbered) {
                    // Add lot-numbered items, passing logFileID
                    addInvoiceLineWithInventoryDetails(invoiceRecord, entry.itemId, entry.lotDetails, entry.itemDescription, entry.storeCode, entry.logFileID);
                } else {
                    // Add non-lot-numbered items, passing logFileID
                    addInvoiceLineWithoutInventoryDetails(invoiceRecord, entry.itemId, entry.quantity, entry.itemDescription, entry.storeCode);
                }
            });

            var invoiceId = invoiceRecord.save();
            var logMessage = `Invoice Created for customer: ${customerId}, from file: ${fileName} , Invoice ID is: ${invoiceId}`;
            log.debug('Invoice Created', logMessage);
            appendToLogFile(logFileID, logMessage);

        } catch (error) {
            log.error('ERROR in reduce Stage', error);
            throw error;
        }
    }

    // Helper functions
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
        var lotDetails = [];
    
        var inventorynumberSearchObj = search.create({
            type: 'inventorynumber',
            filters: [
                ["item.internalid", "anyof", itemId],
                "AND",
                ["location", "anyof", customerLocation],
                "AND",
                ["quantityonhand", "greaterthan", "0"]
            ],
            columns: [
                search.createColumn({ name: "inventorynumber", label: "Number" }),
                search.createColumn({ name: "item", label: "Item" }),
                search.createColumn({ name: "location", label: "Location" }),
                search.createColumn({ name: "quantityonhand", label: "On Hand" }),
                search.createColumn({ name: "quantityavailable", label: "Available" }),
                search.createColumn({ name: "internalid", label: "Internal ID" })
            ]
        });
    
        inventorynumberSearchObj.run().each(function(result) {
            var lotNumberId = result.getValue({ name: 'internalid' });
            var availableQty = parseFloat(result.getValue({ name: 'quantityavailable' }));
    
            if (remainingQty > 0) {
                var allocatedQty = Math.min(remainingQty, availableQty);
                lotDetails.push({ lotNumber: lotNumberId, quantity: allocatedQty });
                remainingQty -= allocatedQty;
            }
    
            return remainingQty > 0;
        });
    
        // Log the lot details for each item
        // log.debug('Lot Details for Item ID: ' + itemId, JSON.stringify(lotDetails));
    
        return lotDetails;
    }
    

    function addInvoiceLineWithInventoryDetails(invoiceRecord, itemId, lotDetails, description, storeCode, logFileID) {
        try {
            invoiceRecord.selectNewLine({ sublistId: 'item' });
            invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemId });
            invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: description });
            invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_storecode', value: storeCode });
    
            var totalQuantity = lotDetails.reduce(function(sum, lot) { return sum + lot.quantity; }, 0);
            invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: totalQuantity });
    
            // // Check if amount is valid
            // if (!amount || isNaN(amount)) {
            //     var errorMessage = `Amount is invalid or missing for item ${itemId} (${description}).`;
            //     appendToLogFile(logFileID, errorMessage);  // Log the item causing the error
            //     throw new Error(errorMessage);
            // }
    
            // invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: amount });
    
            var inventoryDetail = invoiceRecord.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });
    
            if (inventoryDetail && lotDetails && lotDetails.length > 0) {
                lotDetails.forEach(function(lot) {
                    inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });
                    inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: lot.lotNumber });
                    inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: lot.quantity });
                    inventoryDetail.commitLine({ sublistId: 'inventoryassignment' });
                });
            } else {
                var errorMessage = `No inventory details found for item ID: ${itemId}.`;
                appendToLogFile(logFileID, errorMessage);
                throw new Error(errorMessage);
            }
    
            invoiceRecord.commitLine({ sublistId: 'item' });
    
        } catch (error) {
            var logMessage = `Error while processing item ${itemId} (${description}) with Store Code: ${storeCode}. Error: ${error.message}`;
            appendToLogFile(logFileID, logMessage);  // Log the item and error message
            throw error;  // Rethrow the error to ensure proper handling
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

    function checkStoreCode(storeCode, customer) {
        var customrecord_vs_add_new_store_consrepSearchObj = search.create({
            type: "customrecord_vs_add_new_store_consrep",
            filters: [
                ["custrecord_vs_consrep_storecode", "is", storeCode],
                "AND",
                ["custrecord_vs_store_customer", "anyof", customer]
            ],
            columns: [search.createColumn({ name: "internalid", label: "Internal ID" })]
        });

        var result = customrecord_vs_add_new_store_consrepSearchObj.run().getRange({ start: 0, end: 1 });
        return result.length > 0;
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

    return { getInputData, map, reduce };
});
