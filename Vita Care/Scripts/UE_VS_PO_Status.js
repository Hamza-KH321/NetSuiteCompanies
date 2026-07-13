/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search'], function(record, search) {

    function beforeSubmit(context) {
        try {
            if (context.type !== context.UserEventType.EDIT) {
                return;
            }

            var purchaseOrder = context.newRecord;
            var internalId = purchaseOrder.id; // Current Purchase Order internal ID

            // Create the search
            var purchaseOrderSearch = search.create({
                type: "purchaseorder",
                filters: [
                    ["type", "anyof", "PurchOrd"],
                    "AND",
                    ["mainline", "is", "F"],
                    "AND",
                    ["internalid", "anyof", internalId],
                    "AND",
                    ["taxline", "is", "F"],
                    "AND",
                    ["status", "anyof", "PurchOrd:H"]
                ],
                columns: [
                    search.createColumn({ name: "tranid", summary: "GROUP", label: "Document Number" }),
                    search.createColumn({ name: "quantity", summary: "SUM", label: "Quantity" }),
                    search.createColumn({ name: "quantityshiprecv", summary: "SUM", label: "Quantity Fulfilled/Received" }),
                    search.createColumn({ name: "statusref", summary: "GROUP", label: "Status" })
                ]
            });

            var quantity = 0;
            var quantityFulfilled = 0;
            var status = null;

            // Run the search and process the results
            purchaseOrderSearch.run().each(function(result) {
                quantity = parseFloat(result.getValue({ name: "quantity", summary: "SUM" })) || 0;
                quantityFulfilled = parseFloat(result.getValue({ name: "quantityshiprecv", summary: "SUM" })) || 0;
                status = result.getValue({ name: "statusref", summary: "GROUP" });
                return true; // Continue processing
            });

            // log.debug('Order Quantity is :', quantity);
            // log.debug('Quantity Fulfilled is :', quantityFulfilled);
            // log.debug('Status is :', status);

            if (status === "PurchOrd:H") {
                var remainingQuantity = quantity - quantityFulfilled;

                // log.debug('Remaining Quantity is :', remainingQuantity);

                // Update the custom field based on the result
                if (remainingQuantity === 0) {
                    purchaseOrder.setValue({ fieldId: "custbody_vs_po_status", value: "Closed / Fully Received" });
                } else if (remainingQuantity > 0 && remainingQuantity !== quantity) {
                    purchaseOrder.setValue({ fieldId: "custbody_vs_po_status", value: "Closed / Partially Received" });
                } else if (remainingQuantity > 0 && remainingQuantity === quantity) {
                    purchaseOrder.setValue({ fieldId: "custbody_vs_po_status", value: "Closed / Pending Receive" });
                }
            } else {
                // Set the field to empty if status is not H
                purchaseOrder.setValue({ fieldId: "custbody_vs_po_status", value: "" });
            }
        } catch (error) {
            log.error('ERROR!', error);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };

});
