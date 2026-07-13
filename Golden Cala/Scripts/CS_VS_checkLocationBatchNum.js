/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/record', 'N/log', 'N/ui/message', 'N/search'],

    function(record, log, message, search) {

        function fieldChanged(context) {
            try {
                var currentRecord = context.currentRecord;
                var fieldId = context.fieldId;

                // Check if the changed field is custrecord_vs_location
                if (fieldId === 'custrecord_vs_location') {
                    var newLocation = currentRecord.getValue({
                        fieldId: 'custrecord_vs_location'
                    });

                                

                    // Run the saved search
                    var inventorybalanceSearchObj = search.create({
                        type: "inventorybalance",
                        filters: [
                            ["location", "anyof", newLocation]
                        ],
                        columns: [
                            search.createColumn({
                                name: "item",
                                sort: search.Sort.ASC,
                                label: "Item"
                            }),

                            search.createColumn({
                                name: "location",
                                label: "Location"
                            }),
                            search.createColumn({
                                name: "inventorynumber",
                                label: "Inventory Number"
                            }),
                        ]
                    });

                    inventorybalanceSearchObj.run().each(function(result) {
                        var searchLocation = result.getValue({
                            name: 'location'
                        });

                        if (newLocation == searchLocation) {
                            return true; // continue processing results
                        } else {
                            // Check if the field exists on the current record
                            var batchNumberField = currentRecord.getField({
                                fieldId: 'custrecord_vs_batchnumber_pos'
                            });

                            if (batchNumberField) {
                                // If the location doesn't match, lock the specified field
                                batchNumberField.isDisabled = true;
                            } else {
                                log.error('Field Not Found', 'The field with ID "custrecord_vs_batchnumber_pos" was not found on the current record.');
                            }

                            // Stop processing results
                            return false;
                        }
                    });
                }
            } catch (error) {
                log.error('ERROR', error);
            }
        }

        return {
            fieldChanged: fieldChanged
        };

    });
