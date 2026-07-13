/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Item Tax Amount
 */
define(['N/log'], function (log) {

    function beforeSubmit(context) {
        try {
            log.debug("beforeSubmit Triggered", "Script started");

            var rec = context.newRecord;

            // Get number of item lines
            var lineCount = rec.getLineCount({ sublistId: "item" });

            log.debug("Item Line Count", lineCount);

            // Loop through all item lines
            for (var i = 0; i < lineCount; i++) {

                // Get tax1amt value
                var taxAmount = rec.getSublistValue({ sublistId: "item", fieldId: "tax1amt", line: i });

                log.debug("Line Tax Amount", "Line " + i + " tax1amt = " + taxAmount);

                // Set value into custom column field
                rec.setSublistValue({ sublistId: "item", fieldId: "custcol_vs_item_tax_amount", line: i, value: taxAmount || 0 });

                log.debug("Updated Line", "Line " + i + " custcol_vs_item_tax_amount set");
            }

            log.debug("beforeSubmit Completed", "All lines updated successfully");

        } catch (e) {
            log.error("Error in beforeSubmit", e.message);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };

});
