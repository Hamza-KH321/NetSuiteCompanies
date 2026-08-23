/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API Pay Single Vendor
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function onRequest(context) {
        var request = context.request;
        var response = context.response;

        if (request.method !== 'POST') {
            response.write(JSON.stringify({
                success: false,
                code: 'METHOD_NOT_ALLOWED',
                message: 'Use POST with JSON body.'
            }));
            return;
        }

        try {
            var data = JSON.parse(request.body || '{}');
            var vendorId = data.vendor;
            var accountId = data.account;
            var totalAmount = parseFloat(data.amount || 0);

            if (!vendorId || !accountId || !totalAmount) {
                throw new Error("Missing vendor, account or amount.");
            }

            // Create Vendor Payment
            var vendorPayment = record.create({
                type: record.Type.VENDOR_PAYMENT,
                isDynamic: true
            });

            vendorPayment.setValue({ fieldId: 'customform', value: 166 }); // Shoof Bill Payment form
            vendorPayment.setValue({ fieldId: 'entity', value: vendorId });
            vendorPayment.setValue({ fieldId: 'subsidiary', value: 2 });
            vendorPayment.setValue({ fieldId: 'currency', value: 1 });
            vendorPayment.setValue({ fieldId: 'account', value: accountId });

            var billSearch = search.create({
                type: 'vendorbill',
                filters: [
                    ['type', 'anyof', 'VendBill'],
                    'AND',
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['status', 'anyof', 'VendBill:A'], // Open bills
                    'AND',
                    ['entity', 'anyof', vendorId]
                ],
                columns: [
                    search.createColumn({ name: 'internalid' }),
                    search.createColumn({ name: 'amountremaining' }),
                    search.createColumn({ name: 'trandate', sort: search.Sort.ASC })
                ]
            });

            var bills = [];
            billSearch.run().each(function (result) {
                bills.push({
                    id: result.getValue('internalid'),
                    remaining: parseFloat(result.getValue('amountremaining'))
                });
                return true;
            });

            log.audit('Open Bills', bills);

            var lineCount = vendorPayment.getLineCount({ sublistId: 'apply' });
            for (var i = 0; i < lineCount && totalAmount > 0; i++) {
                var billId = vendorPayment.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'internalid',
                    line: i
                });

                var bill = bills.find(b => String(b.id) === String(billId));
                if (!bill) continue;

                var applyAmt = Math.min(bill.remaining, totalAmount);

                vendorPayment.selectLine({ sublistId: 'apply', line: i });
                vendorPayment.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'apply', value: true });
                vendorPayment.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'amount', value: applyAmt });
                vendorPayment.commitLine({ sublistId: 'apply' });

                totalAmount -= applyAmt;
            }

            var paymentId = vendorPayment.save({ enableSourcing: true, ignoreMandatoryFields: true });

            response.write(JSON.stringify({
                success: true,
                paymentId: paymentId,
                message: 'Vendor Payment created successfully.'
            }));

        } catch (e) {
            log.error('ERROR', e);
            response.write(JSON.stringify({
                success: false,
                message: e.message || e.toString()
            }));
        }
    }

    return { onRequest: onRequest };

});
