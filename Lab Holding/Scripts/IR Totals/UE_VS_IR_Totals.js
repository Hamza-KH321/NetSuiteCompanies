/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || IR Totals
 */
define(['N/log'], function (log) {

    function beforeSubmit(context) {
        try {
            log.debug("beforeSubmit Triggered", "Starting IR Totals Calculation");

            var newRec = context.newRecord;

            var totalQty = 0;
            var totalAmount = 0;

            // ---------- ITEM SUBLIST ----------
            var itemLineCount = newRec.getLineCount({ sublistId: "item" });
            log.debug("Item Line Count", itemLineCount);

            if (itemLineCount > 0) {

                for (var i = 0; i < itemLineCount; i++) {

                    var qty = newRec.getSublistValue({ sublistId: "item", fieldId: "quantity", line: i }) || 0;
                    var rate = newRec.getSublistValue({ sublistId: "item", fieldId: "rate", line: i }) || 0;

                    // Get Tax Field Value
                    var taxFieldValue = newRec.getSublistValue({ sublistId: "item", fieldId: "custcol_vs_item_tax_amount", line: i }) || 0;

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
                var expenseLineCount = newRec.getLineCount({ sublistId: "expense" });
                log.debug("Expense Line Count", expenseLineCount);

                for (var j = 0; j < expenseLineCount; j++) {

                    var amount = newRec.getSublistValue({ sublistId: "expense", fieldId: "amount", line: j }) || 0;

                    totalAmount += parseFloat(amount);
                }
            }

            log.debug("Total Quantity Before Set", totalQty);
            log.debug("Total Amount Before Round", totalAmount);

            // -----------------------------
            // ROUND TOTAL AMOUNT (2 decimals)
            // -----------------------------
            totalAmount = Math.round(totalAmount * 100) / 100;

            log.debug("Total Amount After Round", totalAmount);

            // ---------- SET BODY FIELDS ----------
            newRec.setValue({ fieldId: "custbody_vs_ir_total_quantity", value: totalQty });
            newRec.setValue({ fieldId: "custbody_vs_ir_total_amount", value: totalAmount });

            log.debug("beforeSubmit Completed", "Totals updated successfully");

        } catch (e) {
            log.error("beforeSubmit Error", e.message);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };

});
