/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/file', 'N/search', 'N/runtime', 'N/format'], (record, file, search, runtime, format) => {

    const getInputData = (context) => {
        try {
            const fileId = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_cons_file_id' });
            const customerId = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_customer_id' });
            const fileName = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_cons_file_name' });
            const logFileID = runtime.getCurrentScript().getParameter({ name: 'custscript_vs_log_file_id' });

            if (!fileId || !customerId) {
                throw new Error('File ID or Customer ID is missing. Please check the Suitelet script.');
            }

            const uploadedFile = file.load({ id: fileId });
            const fileContent = uploadedFile.getContents();
            const lines = fileContent.split('\n');
            const headers = lines[0].split(',');

            const data = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].split(',');
                if (line.length === headers.length) {
                    const row = {};
                    for (let j = 0; j < headers.length; j++) {
                        row[headers[j].trim()] = line[j].trim();
                    }
                    data.push(row);
                }
            }

            // Add the customerID from the Suitelet to each data row
            data.forEach(row => { row.customerId = customerId; });
            data.forEach(row => { row.fileName = fileName; });
            data.forEach(row => { row.logFileID = logFileID; });

            const customerRecord = record.load({ type: record.Type.CUSTOMER, id: customerId });
            const customerLocation = customerRecord.getValue({ fieldId: 'custentity_vs_cons_location_customer' });

            // Add the customerLocation from the Suitelet to each data row
            data.forEach(row => { row.customerLocation = customerLocation; });

            return data;

        } catch (error) {
            log.error('ERROR in getInputData Stage ', error);
        }
    };

    const map = (context) => {
        try {
            const data = JSON.parse(context.value);

            const itemId = data['Item ID'];
            const storeCode = data['Store Code'];
            const quantity = parseFloat(data['# Units']);
            const amount = parseFloat(data['$ Revenue']);
            const customerId = data.customerId;
            const date = data['Month'];
            const customerLocation = data.customerLocation;
            const fileName = data.fileName;
            const logFileID = data.logFileID;

            if (isNaN(amount) || amount <= 0) {
                const message = `Amount is invalid or missing for item ${itemId}.`;
                log.error('Invalid Amount', message);
                appendToLogFile(logFileID, message);
            }

            if (!date) {
                const message = `Date is missing for customer: ${customerId}`;
                log.error('Missing Date', message);
                appendToLogFile(logFileID, message);
                return;
            }

            // Validate the store code for the customer
            const storeCodeValid = checkStoreCode(storeCode, customerId);

            // Write data to the reduce stage, including validation status
            context.write({
                key: '1', // Single key to ensure all data goes to the same reduce stage
                value: JSON.stringify({
                    itemId: itemId,
                    storeCode: storeCode,
                    quantity: quantity,
                    itemDescription: data['Item Descreption'],
                    amount: amount,
                    customerId: customerId,
                    date: date,
                    customerLocation: customerLocation,
                    storeCodeValid: storeCodeValid, // Pass validation flag to reduce
                    fileName: fileName,
                    logFileID: logFileID

                })
            });
        } catch (error) {
            const logFileID = JSON.parse(context.value).logFileID;
            log.error('ERROR in map Stage ', error);
            appendToLogFile(logFileID, `ERROR in map Stage: ${error.message}`);
        }
    };

    const reduce = (context) => {
        try {
            const itemData = context.values.map(JSON.parse);
            const firstEntry = itemData[0];
            const customerId = firstEntry.customerId;
            const fileName = firstEntry.fileName;
            const logFileID = firstEntry.logFileID;

            if (!customerId) {
                const message = `Customer is invalid or missing for entry: ${JSON.stringify(firstEntry)}`;
                log.error('Invalid Customer', message);
                appendToLogFile(logFileID, message);
                throw new Error(message);
            }
    
            // Collect invalid store codes
            const invalidStoreCodes = [];
    
            // Check if any line has an invalid store code
            itemData.forEach(entry => {
                if (!entry.storeCodeValid) {
                    invalidStoreCodes.push(entry.storeCode); // Add invalid store code to the array
                }
            });
    
            if (invalidStoreCodes.length > 0) {
                const message = `The following store codes are invalid: ${invalidStoreCodes.join(', ')}. Invoice creation aborted.`;
                log.error('Invalid Store Codes Detected', message);
                appendToLogFile(logFileID, message);
                return;
            }
    
            // Continue with invoice creation if all store codes are valid
            const customerLocation = firstEntry.customerLocation;
    
            // Create the invoice
            const invoiceRecord = record.create({ type: record.Type.INVOICE, isDynamic: true });
            invoiceRecord.setValue({ fieldId: 'entity', value: customerId });
            invoiceRecord.setValue({ fieldId: 'location', value: customerLocation });
            invoiceRecord.setValue({ fieldId: 'custbody_vs_consignment_source', value: fileName });
    
            if (firstEntry.date) {
                const parsedDate = format.parse({ value: firstEntry.date, type: format.Type.DATE });
                invoiceRecord.setValue({ fieldId: 'trandate', value: parsedDate });
            } else {
                invoiceRecord.setValue({ fieldId: 'trandate', value: new Date() });
            }
    
            // Aggregate quantities for each unique item and store code
            const aggregatedData = {};
            itemData.forEach(entry => {
                const key = `${entry.itemId}-${entry.storeCode}`;
                if (!aggregatedData[key]) {
                    aggregatedData[key] = {
                        itemId: entry.itemId,
                        storeCode: entry.storeCode,
                        totalQuantity: 0,
                        itemDescription: entry.itemDescription,
                        amount: entry.amount,
                    };
                }
    
                // Sum quantities for items with the same itemId and storeCode
                aggregatedData[key].totalQuantity += entry.quantity;
            });
    
            // Add aggregated lines to the invoice
            Object.keys(aggregatedData).forEach(key => {
                const entry = aggregatedData[key];
                const isLotNumbered = checkIfLotNumbered(entry.itemId);
    
                if (isLotNumbered) {
                    const lotDetails = getLotDetails(entry.itemId, entry.totalQuantity, customerLocation);
                    addInvoiceLineWithInventoryDetails(invoiceRecord, entry.itemId, lotDetails, entry.itemDescription, entry.amount, entry.storeCode);
                } else {
                    addInvoiceLineWithoutInventoryDetails(invoiceRecord, entry.itemId, entry.totalQuantity, entry.itemDescription, entry.amount, entry.storeCode);
                }
            });

            const invoiceId = invoiceRecord.save();
            const logMessage = `Invoice Created for customer: ${customerId}, from file: ${fileName} , Invoice ID is: ${invoiceId}`;
            log.debug('Invoice Created', logMessage);
            appendToLogFile(logFileID, logMessage);
            
    
        } catch (error) {
            log.error('ERROR in reduce Stage', error);
            throw error;
        }
    };

    // Helper functions
    const checkIfLotNumbered = (itemId) => {
        const itemTypeSearch = search.lookupFields({
            type: search.Type.ITEM,
            id: itemId,
            columns: ['islotitem', 'isserialitem']
        });

        return itemTypeSearch.islotitem || itemTypeSearch.isserialitem;
    };

    const getLotDetails = (itemId, requiredQuantity, customerLocation) => {
        let remainingQty = requiredQuantity;
        const lotDetails = [];

        const inventorynumberSearchObj = search.create({
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

        inventorynumberSearchObj.run().each((result) => {
            const lotNumberId = result.getValue({ name: 'internalid' });
            const availableQty = parseFloat(result.getValue({ name: 'quantityavailable' }));

            if (remainingQty > 0) {
                const allocatedQty = Math.min(remainingQty, availableQty);
                lotDetails.push({ lotNumber: lotNumberId, quantity: allocatedQty });
                remainingQty -= allocatedQty;
            }

            return remainingQty > 0;
        });

        return lotDetails;
    };

    const addInvoiceLineWithInventoryDetails = (invoiceRecord, itemId, lotDetails, description, amount, storeCode) => {
        invoiceRecord.selectNewLine({ sublistId: 'item' });
        invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemId });
        invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: description });
        invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_storename', value: storeCode });

        const totalQuantity = lotDetails.reduce((sum, lot) => sum + lot.quantity, 0);
        invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: totalQuantity });

        const inventoryDetail = invoiceRecord.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });

        if (inventoryDetail && lotDetails && lotDetails.length > 0) {
            lotDetails.forEach((lot) => {
                inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });
                inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: lot.lotNumber });
                inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: lot.quantity });
                inventoryDetail.commitLine({ sublistId: 'inventoryassignment' });
            });
        } else {
            log.error('Inventory Detail Error', `No inventory details found for item ID: ${itemId}`);
        }

        invoiceRecord.commitLine({ sublistId: 'item' });
    };

    const addInvoiceLineWithoutInventoryDetails = (invoiceRecord, itemId, quantity, description, amount, storeCode) => {
        invoiceRecord.selectNewLine({ sublistId: 'item' });
        invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemId });
        invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: quantity });
        invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: description });
        invoiceRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vs_storename', value: storeCode });
        invoiceRecord.commitLine({ sublistId: 'item' });
    };

    const checkStoreCode = (storeCode, customer) => {
        const customrecord_vs_add_new_store_consrepSearchObj = search.create({
            type: "customrecord_vs_add_new_store_consrep",
            filters: [
                ["custrecord_vs_consrep_storecode", "is", storeCode],
                "AND",
                ["custrecord_vs_store_customer", "anyof", customer]
            ],
            columns: [search.createColumn({ name: "internalid", label: "Internal ID" })]
        });

        const result = customrecord_vs_add_new_store_consrepSearchObj.run().getRange({ start: 0, end: 1 });
        return result.length > 0;
    };

    const appendToLogFile = (logFileID, message) => {
        try {
            // Load the existing log file
            let logFile = file.load({ id: logFileID });

            // Get the current contents of the file
            let fileContent = logFile.getContents();

            // Append the new log message
            fileContent += `\n${message}`;

            // Write the updated content back to the file
            let newFile = file.create({
                name: logFile.name,
                fileType: file.Type.PLAINTEXT,
                contents: fileContent,
                folder: logFile.folder
            });

            newFile.save(); // Save the updated file with new log entry
        } catch (error) {
            log.error('Error appending to log file', error);
        }
    };
    

    return { getInputData, map, reduce };
});
