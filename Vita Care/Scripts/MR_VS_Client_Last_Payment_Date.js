/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/search', 'N/record', 'N/log', 'N/format'], function (search, record, log, format) {

    function getInputData() {
        // Search for all active customers
        return search.create({
            type: "customer",
            filters: [
                ["isinactive", "is", "F"],
                // "AND", 
                // ["internalid","anyof","55096"]
            ],
            columns: [
                search.createColumn({ name: "entitynumber", label: "Number" }),
                search.createColumn({ name: "internalid", label: "Internal ID" })
            ]
        });
    }

    function map(context) {
        var result = JSON.parse(context.value);
        var customerId = result.id;  // Customer Internal ID

        try {
            // Search for customer payments, ordered by most recent date
            var customerpaymentSearchObj = search.create({
                type: "customerpayment",
                settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                filters: [
                    ["mainline", "is", "T"],
                    "AND",
                    ["type", "anyof", "CustPymt"],
                    "AND",
                    ["customer.internalid", "anyof", customerId]
                ],
                columns: [
                    search.createColumn({ name: "tranid", label: "Document Number" }),
                    search.createColumn({ name: "trandate", sort: search.Sort.DESC, label: "Date" }) // Sort by newest date
                ]
            });

            var newestPaymentDate = null;
            customerpaymentSearchObj.run().each(function (result) {
                var dateString = result.getValue("trandate"); // Get newest date as string
                if (dateString) {
                    newestPaymentDate = format.parse({ value: dateString, type: format.Type.DATE }); // Convert to Date object
                }
                return false; // Stop after the first (newest) result
            });

            if (newestPaymentDate) {
                // Load the customer record
                var customerRecord = record.load({
                    type: record.Type.CUSTOMER,
                    id: customerId,
                    isDynamic: false
                });

                // Update the last payment date field
                customerRecord.setValue({
                    fieldId: 'custentity_vs_last_payment_date',
                    value: newestPaymentDate
                });

                // Save the record
                customerRecord.save();
                log.debug("Updated Customer", "Customer ID: " + customerId + " | Last Payment Date: " + newestPaymentDate);
            }

        } catch (error) {
            log.error("Error Processing Customer ID: " + customerId, error);
        }
    }

    return {
        getInputData: getInputData,
        map: map
    };
});
