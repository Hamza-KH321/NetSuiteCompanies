/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/log', 'N/runtime', 'N/search'],
    function (record, log, runtime, search) {

        function getInputData() {
            try {
                var scriptObj = runtime.getCurrentScript();
                var fileContents = scriptObj.getParameter({ name: 'custscript_csv_data' });

                if (!fileContents || fileContents.trim() === '') {
                    throw new Error('CSV data is missing.');
                }

                var fileLines = fileContents.split(/\r?\n/);
                var csvData = [];

                for (var i = 1; i < fileLines.length; i++) {
                    var columns = fileLines[i].split(',');
                    if (columns.length < 6) continue;

                    csvData.push({
                        item: columns[0].trim(),
                        location: columns[1].trim(),
                        minQuantity: parseFloat(columns[2].trim()) || 0,
                        maxQuantity: parseFloat(columns[3].trim()) || 0,
                        unitsPerBox: parseFloat(columns[4].trim()) || 0,
                        threshold: parseFloat(columns[5].trim()) || 0
                    });
                }

                log.audit('Parsed CSV Data for Creation', 'Total Rows: ' + csvData.length);
                
                return csvData;
            } catch (error) {
                log.error('ERROR in Get Input Stage', error);
            }
        }

        function map(context) {
            var rowData = JSON.parse(context.value);
            try {
                var itemId = getItemInternalId(rowData.item);
                if (!itemId) {
                    log.error('Item Lookup Failed', 'No internal ID found for item: ' + rowData.item);
                    return;
                }

                var locationMapping = {
                    "Abha": 3,
                    "Al-Sharqiah": 4,
                    "Jeddah": 2,
                    "JeddahVWH": 5,
                    "Riyadh": 1
                };
                var locationId = locationMapping[rowData.location] || null;

                if (!locationId) {
                    log.error('Location Mapping Failed', 'No mapping found for location: ' + rowData.location);
                    return;
                }

                var newRecord = record.create({
                    type: 'customrecord_vs_itemminmaxquantity',
                    isDynamic: true
                });

                newRecord.setValue({ fieldId: 'custrecord_vs_itemminmax', value: itemId });
                newRecord.setValue({ fieldId: 'custrecord_vs_min', value: rowData.minQuantity });
                newRecord.setValue({ fieldId: 'custrecord_vs_locationminmax', value: locationId });
                newRecord.setValue({ fieldId: 'custrecord_vs_maxquantity', value: rowData.maxQuantity });
                newRecord.setValue({ fieldId: 'custrecord_vs_unitperbox', value: rowData.unitsPerBox });
                newRecord.setValue({ fieldId: 'custrecord_vs_threshould', value: rowData.threshold });

                var savedId = newRecord.save();
                log.audit('Created Record', 'ID: ' + savedId);
            } catch (error) {
                log.error('Error Creating Record', error);
            }
        }

        function getItemInternalId(itemCode) {
            try {
                var itemSearch = search.create({
                    type: search.Type.ITEM,
                    filters: [
                        ['itemid', 'is', itemCode]
                    ],
                    columns: ['internalid']
                });

                var result = itemSearch.run().getRange({ start: 0, end: 1 });

                return result.length > 0 ? result[0].getValue('internalid') : null;
            } catch (error) {
                log.error('Error in Item Lookup', error);
                return null;
            }
        }

        return {
            getInputData: getInputData,
            map: map
        };
    });
