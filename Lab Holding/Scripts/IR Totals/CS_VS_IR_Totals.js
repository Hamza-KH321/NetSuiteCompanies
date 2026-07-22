/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || IR Totals
 */

define(['N/log'], function (log) {

    // -----------------------------
    // MAIN TOTALS FUNCTION
    // -----------------------------
    function calculateTotals(currentRec) {
        try {
            var totalQty = 0;
            var totalAmount = 0;

            // ---------- ITEM SUBLIST ----------
            var itemLineCount = currentRec.getLineCount({ sublistId: "item" });
            log.debug("Item Line Count", itemLineCount);

            if (itemLineCount > 0) {

                for (var i = 0; i < itemLineCount; i++) {

                    var qty = currentRec.getSublistValue({ sublistId: "item", fieldId: "quantity", line: i }) || 0;
                    var rate = currentRec.getSublistValue({ sublistId: "item", fieldId: "rate", line: i }) || 0;

                    // Get Tax Amount Field Value
                    var taxFieldValue = currentRec.getSublistValue({ sublistId: "item", fieldId: "custcol_vs_item_tax_amount", line: i }) || 0;

                    // Calculate Line Amount
                    var lineAmount = (parseFloat(qty) * parseFloat(rate));

                    log.debug("Line Calculation Before Tax", {
                        line: i,
                        qty: qty,
                        rate: rate,
                        amount: lineAmount,
                        taxField: taxFieldValue
                    });

                    // Apply Extra Tax Logic if Field > 0
                    if (parseFloat(taxFieldValue) > 0) {

                        var extraTax = lineAmount * 0.05;
                        lineAmount = lineAmount + extraTax;

                        log.debug("Tax Applied", {
                            line: i,
                            extraTax: extraTax,
                            newLineAmount: lineAmount
                        });
                    }

                    // Add Totals
                    totalQty += parseFloat(qty);
                    totalAmount += parseFloat(lineAmount);
                }

            } else {

                // ---------- EXPENSE SUBLIST ----------
                var expenseLineCount = currentRec.getLineCount({ sublistId: "expense" });
                log.debug("Expense Line Count", expenseLineCount);

                for (var j = 0; j < expenseLineCount; j++) {

                    var amount = currentRec.getSublistValue({ sublistId: "expense", fieldId: "amount", line: j }) || 0;

                    totalAmount += parseFloat(amount);
                }
            }

            log.debug("Total Quantity Calculated", totalQty);
            log.debug("Total Amount Before Round", totalAmount);

            // -----------------------------
            // ROUND TOTAL AMOUNT (2 decimals)
            // -----------------------------
            totalAmount = Math.round(totalAmount * 100) / 100;

            log.debug("Total Amount After Round", totalAmount);

            // ---------- SET BODY FIELDS ----------
            currentRec.setValue({ fieldId: "custbody_vs_ir_total_quantity", value: totalQty });
            currentRec.setValue({ fieldId: "custbody_vs_ir_total_amount", value: totalAmount });

        } catch (e) {
            log.error("calculateTotals Error", e.message);
        }
    }

    // -----------------------------
    // PAGE INIT
    // -----------------------------
    function pageInit(context) {
        try {
            var currentRec = context.currentRecord;

            log.debug("pageInit Triggered", "Running totals calculation on load");

            calculateTotals(currentRec);

        } catch (e) {
            log.error("pageInit Error", e.message);
        }
    }

    // -----------------------------
    // FIELD CHANGED
    // -----------------------------
    function fieldChanged(context) {
        try {
            var currentRec = context.currentRecord;
            var sublistId = context.sublistId;
            var fieldId = context.fieldId;

            log.debug("fieldChanged Triggered", {
                sublist: sublistId,
                field: fieldId
            });

            // Only run when line values change
            if (
                (sublistId === "item" &&
                    (fieldId === "quantity" ||
                        fieldId === "rate" ||
                        fieldId === "custcol_vs_item_tax_amount")) ||

                (sublistId === "expense" && fieldId === "amount")
            ) {
                calculateTotals(currentRec);
            }

        } catch (e) {
            log.error("fieldChanged Error", e.message);
        }
    }

    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged
    };

});
