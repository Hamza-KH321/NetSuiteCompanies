/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Vendor Total Purchases\Balance
 */
define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function afterSubmit(context) {
        try {
            log.debug('afterSubmit Triggered', context.type);

            var newRec = context.newRecord;
            var recType = newRec.type;
            var recId = newRec.id;

            var vendorId = newRec.getValue({ fieldId: 'entity' });
            log.debug('Vendor ID', vendorId);

            if (!vendorId) {
                log.debug('No Vendor Found', 'Exit script');
                return;
            }

            // Load record to update values
            var rec = record.load({
                type: recType,
                id: recId,
                isDynamic: false
            });

            /* ===============================
             * 1. TOTAL PURCHASES MTD
             * =============================== */
            var totalPurchasesMTD = 0;

            try {
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

                if (poResult && poResult.length > 0) {
                    totalPurchasesMTD = parseFloat(
                        poResult[0].getValue({ name: "amount", summary: "SUM" })
                    ) || 0;
                }

                log.debug('Total Purchases MTD', totalPurchasesMTD);

            } catch (e1) {
                log.error('MTD Purchase Search Error', e1);
            }

            rec.setValue({ fieldId: 'custbody_vs_total_purchases_mtd', value: totalPurchasesMTD });

            /* ===============================
             * 2. VENDOR BALANCE
             * =============================== */
            var vendorBalance = 0;

            try {
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

                if (vbResult && vbResult.length > 0) {
                    vendorBalance = parseFloat(
                        vbResult[0].getValue({ name: "amount", summary: "SUM" })
                    ) || 0;
                }

                log.debug('Vendor Balance', vendorBalance);

            } catch (e2) {
                log.error('Vendor Balance Search Error', e2);
            }

            rec.setValue({ fieldId: 'custbody_vs_vendor_balance', value: vendorBalance });
            rec.save({ enableSourcing: false, ignoreMandatoryFields: true });

            log.debug('Record Saved Successfully', recId);

        } catch (e) {
            log.error('afterSubmit Error', e);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
