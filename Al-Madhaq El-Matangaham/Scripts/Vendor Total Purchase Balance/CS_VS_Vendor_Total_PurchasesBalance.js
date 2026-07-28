/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Vendor Total Purchases\Balance
 */
define(['N/search', 'N/currentRecord', 'N/log'], function (search, currentRecord, log) {

    function fieldChanged(context) {
        try {
            if (context.fieldId !== 'entity') {
                return;
            }

            var rec = currentRecord.get();
            var vendorId = rec.getValue({ fieldId: 'entity' });

            if (!vendorId) {
                return;
            }

            /* ===============================
             * 1. TOTAL PURCHASES MTD
             * =============================== */
            var poSearch = search.create({
                type: "purchaseorder",
                settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "VendBill"],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["mainname", "anyof", vendorId],
                    "AND",
                    ["trandate", "within", "thismonthtodate"]
                ],
                columns: [
                    search.createColumn({ name: "amount", summary: "SUM" })
                ]
            });

            var poResult = poSearch.run().getRange({ start: 0, end: 1 });
            var totalPurchasesMTD = 0;

            if (poResult && poResult.length > 0) {
                totalPurchasesMTD = parseFloat(poResult[0].getValue({ name: "amount", summary: "SUM" })) || 0;
            }

            rec.setValue({ fieldId: 'custbody_vs_total_purchases_mtd', value: totalPurchasesMTD });

            /* ===============================
             * 2. VENDOR BALANCE
             * =============================== */
            var vendorBalanceSearch = search.create({
                type: "transaction",
                settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "VendBill", "VendPymt"],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["mainname", "anyof", vendorId]
                ],
                columns: [
                    search.createColumn({ name: "amount", summary: "SUM" })
                ]
            });

            var vbResult = vendorBalanceSearch.run().getRange({ start: 0, end: 1 });
            var vendorBalance = 0;

            if (vbResult && vbResult.length > 0) {
                vendorBalance = parseFloat(vbResult[0].getValue({ name: "amount", summary: "SUM" })) || 0;
            }

            rec.setValue({ fieldId: 'custbody_vs_vendor_balance', value: vendorBalance });

        } catch (e) {
            log.error('fieldChanged Error', e);
        }
    }

    return {
        fieldChanged: fieldChanged
    };
});
