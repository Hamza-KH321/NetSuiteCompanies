/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/file', 'N/search', 'N/runtime', 'N/format'],
    (serverWidget, file, search, runtime, format) => {

        const onRequest = (scriptContext) => {
            try {
                if (scriptContext.request.method === 'GET') {
                    // Create form
                    const form = serverWidget.createForm({ title: 'Upload File and Select Location' });

                    // File upload field
                    const fileField = form.addField({
                        id: 'custpage_file',
                        type: serverWidget.FieldType.FILE,
                        label: 'Upload CSV File'
                    });
                    fileField.isMandatory = true;

                    // Location dropdown
                    const locationField = form.addField({
                        id: 'custpage_location',
                        type: serverWidget.FieldType.SELECT,
                        label: 'Select Location'
                    });
                    locationField.isMandatory = true;

                    // Add a blank option to the location dropdown
                    locationField.addSelectOption({ value: '', text: '' });

                    // Populate location options using a search
                    const locationSearch = search.create({
                        type: 'location',
                        columns: ['internalid', 'name']
                    });

                    locationSearch.run().each(result => {
                        locationField.addSelectOption({
                            value: result.getValue({ name: 'internalid' }),
                            text: result.getValue({ name: 'name' })
                        });
                        return true;
                    });

                    // Submit button
                    form.addSubmitButton({ label: 'Process File' });

                    // Display the form
                    scriptContext.response.writePage(form);

                } else if (scriptContext.request.method === 'POST') {
                    // Get uploaded file and location
                    const uploadedFile = scriptContext.request.files.custpage_file;
                    const selectedLocation = scriptContext.request.parameters.custpage_location;

                    if (!uploadedFile || !selectedLocation) {
                        throw new Error('Please upload a file and select a location.');
                    }

                    // Read and parse CSV content
                    const fileContent = uploadedFile.getContents();
                    const lines = fileContent.split('\n');
                    const itemData = {};

                    lines.forEach((line, index) => {
                        if (index === 0) return; // Skip header row
                        const [itemId, units] = line.split(',');
                        if (!itemId || !units) return; // Skip invalid lines
                        const parsedUnits = parseInt(units.trim(), 10);
                        if (isNaN(parsedUnits)) return; // Skip invalid quantities
                        itemData[itemId.trim()] = (itemData[itemId.trim()] || 0) + parsedUnits;
                    });

                    // Prepare array of unique item IDs
                    const itemIds = Object.keys(itemData);

                    // Perform search for inventory balances
                    const searchResults = [];
                    const inventorySearch = search.create({
                        type: 'inventorybalance',
                        filters: [
                            ['location', 'anyof', selectedLocation],
                            'AND',
                            ['item', 'anyof'].concat(itemIds),
                            'AND',
                            ['onhand', 'greaterthan', '0'],
                            "AND",
                            [["inventorynumber.expirationdate", "after", "today"], "OR", ["inventorynumber.expirationdate", "isempty", ""]],
                            "AND",
                            ["formulatext: CASE      WHEN SUBSTR({inventorynumber}, -2) != '-D'       AND SUBSTR({inventorynumber}, -3) != '-AS'       AND SUBSTR({inventorynumber}, -2) != '-1'      THEN 'True'  ELSE 'False'END", "is", "True"]

                        ],
                        columns: [
                            search.createColumn({ name: 'item', summary: 'GROUP', label: 'Item' }),
                            search.createColumn({ name: 'onhand', summary: 'SUM', label: 'On Hand' })
                        ]
                    });

                    inventorySearch.run().each(result => {
                        searchResults.push({
                            itemId: result.getValue({ name: 'item', summary: 'GROUP' }),
                            onHand: parseInt(result.getValue({ name: 'onhand', summary: 'SUM' }), 10) || 0
                        });
                        return true;
                    });

                    // Create CSV content
                    let csvContent = 'Item ID,Total Units Requested,On Hand,Exceeded On Hand\n';
                    itemIds.forEach(itemId => {
                        const totalUnits = itemData[itemId] || 0;
                        const onHand = searchResults.find(sr => sr.itemId === itemId)?.onHand || 0;
                        const exceededOnHand = totalUnits > onHand ? 'True' : 'False';
                        csvContent += `${itemId},${totalUnits},${onHand},${exceededOnHand}\n`;
                    });

                    // Serve the CSV file as a download response
                    const fileName = `Processed_Items_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
                    scriptContext.response.setHeader({
                        name: 'Content-Type',
                        value: 'text/csv'
                    });
                    scriptContext.response.setHeader({
                        name: 'Content-Disposition',
                        value: `attachment; filename="${fileName}"`
                    });

                    scriptContext.response.write(csvContent);
                }
            } catch (error) {
                log.error('Error in Suitelet', error);
                throw error;
            }
        };

        return { onRequest };
    });
