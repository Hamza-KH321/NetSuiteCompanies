/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/file', 'N/search', 'N/runtime', 'N/format', 'N/record'],
    (serverWidget, file, search, runtime, format, record) => {

        const onRequest = (scriptContext) => {
            try {
                if (scriptContext.request.method === 'GET') {
                    const form = serverWidget.createForm({ title: 'Upload File for Inventory Validation' });

                    const fileField = form.addField({
                        id: 'custpage_file',
                        type: serverWidget.FieldType.FILE,
                        label: 'Upload CSV File'
                    });
                    fileField.isMandatory = true;

                    form.addSubmitButton({ label: 'Process File' });
                    scriptContext.response.writePage(form);

                } else if (scriptContext.request.method === 'POST') {
                    const uploadedFile = scriptContext.request.files.custpage_file;
                    if (!uploadedFile) throw new Error('Please upload a file.');

                    const fileContent = uploadedFile.getContents();
                    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
                    if (lines.length === 0) throw new Error('CSV file is empty.');

                    const itemLotData = {};
                    let locationName = null;

                    lines.forEach((line, index) => {
                        if (index === 0) return; // Skip header

                        const parts = line.split(',').map(p => p.trim());
                        if (parts.length < 6) return;

                        if (!locationName) {
                            locationName = parts[1];
                        }

                        const itemCode = parts[2];
                        const lotNumber = parts[3];
                        const quantity = parseInt(parts[5], 10);

                        if (!itemCode || !lotNumber || isNaN(quantity)) return;

                        const key = `${itemCode}||${lotNumber}`;
                        itemLotData[key] = (itemLotData[key] || 0) + quantity;
                    });

                    if (!locationName) throw new Error('Location not found in file.');

                    const locationNameToId = {
                        'Abha': 3,
                        'Al-Sharqiah': 4,
                        'Jeddah': 2,
                        'JeddahVWH': 5,
                        'Riyadh': 1
                    };

                    const locationId = locationNameToId[locationName];
                    if (!locationId) {
                        throw new Error('Invalid location name in file: ' + locationName);
                    }

                    const itemCodes = [...new Set(Object.keys(itemLotData).map(key => key.split('||')[0]))];
                    log.debug('Unique Item Codes', itemCodes);

                    // Step 1: Convert item codes to internal IDs using dynamic OR filters
                    const itemFilters = itemCodes.map(code => ['name', 'is', code]);
                    let finalItemFilters = [];

                    if (itemFilters.length === 1) {
                        finalItemFilters = itemFilters[0];
                    } else {
                        for (let i = 0; i < itemFilters.length; i++) {
                            finalItemFilters.push(itemFilters[i]);
                            if (i < itemFilters.length - 1) {
                                finalItemFilters.push('OR');
                            }
                        }
                    }

                    const itemCodeToIdMap = {};
                    const itemSearch = search.create({
                        type: 'item',
                        filters: finalItemFilters,
                        columns: ['internalid', 'name']
                    });

                    itemSearch.run().each(result => {
                        const name = result.getValue({ name: 'name' });
                        const id = result.getValue({ name: 'internalid' });
                        itemCodeToIdMap[name] = id;
                        return true;
                    });

                    log.debug('Item Code to Internal ID Map', itemCodeToIdMap);

                    const itemInternalIds = Object.values(itemCodeToIdMap);
                    if (!itemInternalIds.length) {
                        throw new Error('No matching item internal IDs found.');
                    }

                    // Step 2: Run inventory number search
                    const inventoryResults = {};
                    const inventorySearch = search.create({
                        type: "inventorynumber",
                        filters: [
                            ["location", "anyof", locationId],
                            "AND",
                            ["item", "anyof", itemInternalIds],
                            "AND",
                            ["quantityavailable", "greaterthan", "0"]
                        ],
                        columns: [
                            search.createColumn({ name: "inventorynumber", label: "Number" }),
                            search.createColumn({ name: "item", label: "Item" }),
                            search.createColumn({ name: "quantityavailable", label: "Available" })
                        ]
                    });

                    inventorySearch.run().each(result => {
                        const itemId = result.getValue({ name: "item" }); // Internal ID
                        const itemName = Object.keys(itemCodeToIdMap).find(name => itemCodeToIdMap[name] == itemId);
                        const lotNumber = result.getValue({ name: "inventorynumber" });
                        const availableQty = parseInt(result.getValue({ name: "quantityavailable" }), 10) || 0;

                        const key = `${itemName}||${lotNumber}`;
                        inventoryResults[key] = availableQty;
                        return true;
                    });

                    log.debug('Inventory Results (After Matching)', inventoryResults);

                    // Step 3: Build comparison CSV
                    let csvContent = 'Item Code,Lot Number,Total Quantity Requested,Available,Exceeded Available\n';
                    Object.keys(itemLotData).forEach((key, index) => {
                        const [itemCode, lotNumber] = key.split('||');
                        const requestedQty = itemLotData[key];
                        const availableQty = inventoryResults[key] || 0;
                        const exceeded = requestedQty > availableQty ? 'True' : 'False';

                        log.debug({
                            title: 'Final Comparison',
                            details: {
                                rowIndex: index + 1,
                                itemCode: itemCode,
                                lotNumber: lotNumber,
                                quantityRequested: requestedQty,
                                quantityAvailable: availableQty,
                                exceeded: exceeded
                            }
                        });

                        csvContent += `${itemCode},${lotNumber},${requestedQty},${availableQty},${exceeded}\n`;
                    });

                    // Step 4: Return CSV as downloadable file
                    const fileName = `Validated_Inventory_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
                    scriptContext.response.setHeader({ name: 'Content-Type', value: 'text/csv' });
                    scriptContext.response.setHeader({ name: 'Content-Disposition', value: `attachment; filename="${fileName}"` });
                    scriptContext.response.write(csvContent);
                }
            } catch (error) {
                log.error('Error in Suitelet', error);
                throw error;
            }
        };

        return { onRequest };
    });
