/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/log', 'N/record', 'N/runtime'], function (search, log, record, runtime) {

    function getInputData() {
        try {

            var me = runtime.getCurrentScript();
            var fromDate = me.getParameter({ name: 'custscript_mr_fromdate' });
            var toDate = me.getParameter({ name: 'custscript_mr_todate' });

            log.debug('Executed, Date Parameters: ', { fromDate: fromDate, toDate: toDate })

            var invoiceSearchObj = search.create({
                type: "invoice",
                settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "CustInvc"],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["status", "anyof", "CustInvc:B", "CustInvc:A"],
                    "AND",
                    ["applyingtransaction.type", "anyof", "CustPymt"],
                    "AND",
                    ["trandate", "within", fromDate, toDate]
                ],
                columns: [
                    search.createColumn({ name: "internalid", join: "customer", summary: "GROUP", label: "Client" }),
                    search.createColumn({ name: "internalid", summary: "GROUP", label: "Invoice" }),
                    search.createColumn({ name: "amount", summary: "SUM", label: "Invoice Amount" }),
                    search.createColumn({ name: "trandate", summary: "GROUP", label: "Invoice Date" }),
                    search.createColumn({ name: "formuladate", summary: "GROUP", formula: "NVL({duedate}, {trandate})", label: "Invoice Due Date" }),
                    search.createColumn({ name: "trandate", join: "applyingTransaction", summary: "MAX", label: "Payment Date" }),
                    search.createColumn({ name: "applyingtransaction", summary: "MAX", label: "Payment DN" }),
                    search.createColumn({
                        name: "formulanumeric",
                        summary: "GROUP",
                        formula: "CASE WHEN {status} = 'Open' THEN TO_DATE(TO_CHAR(SYSDATE, 'YYYY-MM-DD'), 'YYYY-MM-DD') - NVL({duedate}, TO_DATE('2024-01-01', 'YYYY-MM-DD')) ELSE NVL({applyingtransaction.trandate}, TO_DATE('2024-01-01', 'YYYY-MM-DD')) - NVL({duedate}, TO_DATE('2024-01-01', 'YYYY-MM-DD')) END",
                        label: "Days Early/Late"
                    }),

                    search.createColumn({
                        name: "formulanumeric",
                        summary: "SUM",
                        formula: "CASE WHEN {status} = 'Open' THEN {amount} ELSE 0 END",
                        label: "Open Amount"
                    }),
                    search.createColumn({
                        name: "formulanumeric",
                        summary: "SUM",
                        formula: "CASE WHEN {status} = 'Paid In Full' THEN {amount} ELSE 0 END",
                        label: "Paid Amount"
                    }),
                    search.createColumn({ name: "status", summary: "GROUP", label: "Status" }),
                    search.createColumn({
                        name: "formuladate",
                        summary: "MAX",
                        formula: "CASE WHEN {status} = 'Open' THEN {today} ELSE {applyingtransaction.trandate} END",
                        label: "Last Payment Date"
                    })

                ]
            });

            var pagedResults = invoiceSearchObj.runPaged({
                pageSize: 1000
            });

            var data = [];

            pagedResults.pageRanges.forEach(function (pageRange) {
                var currentPage = pagedResults.fetch({ index: pageRange.index });
                currentPage.data.forEach(function (result) {
                    var columns = result.columns;

                    var statusText = result.getText(columns[10]) || null;

                    var resultObj = {
                        client: result.getValue(columns[0]) || null,
                        invoice: result.getValue(columns[1]) || null,
                        amount: parseFloat(result.getValue(columns[2])) || 0,
                        trandate: result.getValue(columns[3]) || null,
                        duedate: result.getValue(columns[4]) || null,
                        paymentDate: result.getValue(columns[11]) || null,
                        paymentDn: result.getValue(columns[6]) || null,
                        daysEarlyLate: parseFloat(result.getValue(columns[7])) || 0,
                        openAmount: parseFloat(result.getValue(columns[8])) || 0,
                        paidAmount: parseFloat(result.getValue(columns[9])) || 0,
                        status: statusText
                    };

                    log.debug('resultObj', resultObj);

                    data.push(resultObj);
                });
            });

            return data;
        } catch (error) {
            log.error({ title: 'Error running Invoice Search', details: error });
        }
    }

    function map(context) {
        try {
            var searchResult = JSON.parse(context.value);

            var clientData = {
                clientId: searchResult.client,
                invoice: searchResult.invoice,  // Ensure the invoice ID is included
                amount: searchResult.amount || 0,  // Total invoice amount for this customer
                trandate: searchResult.trandate,  // Invoice Date
                duedate: searchResult.duedate,  // Invoice Due Date
                paymentDate: searchResult.paymentDate,  // Payment Date
                paymentDn: searchResult.paymentDn,  // Payment DN (if necessary)
                daysEarlyLate: searchResult.daysEarlyLate || 0,  // Total Days Early/Late for this customer
                openAmount: searchResult.openAmount || 0, // Total Open invoices amount
                paidAmount: searchResult.paidAmount || 0, // Total Paid invoices amount
                status: searchResult.status || null,
            };

            context.write({ key: clientData.clientId, value: JSON.stringify(clientData) });

        } catch (error) {
            log.error({ title: 'Error in Map Stage', details: error });
        }
    }

    function reduce(context) {
        try {
            var clientDataArray = context.values.map(function (value) {
                try {
                    return JSON.parse(value);
                } catch (error) {
                    log.error({ title: 'Error parsing value in Reduce Stage', details: error + ' - Value: ' + value });
                    return null;
                }
            }).filter(Boolean);

            if (clientDataArray.length === 0) return;

            var openInvoices = clientDataArray.filter(d => d.status === 'Open');
            var paidInvoices = clientDataArray.filter(d => d.status === 'Paid In Full');

            function calculateMetrics(invoices) {
                var totalAmount = 0;
                var weightedDays = 0;
                invoices.forEach(function (data) {
                    totalAmount += data.amount;
                    weightedDays += data.daysEarlyLate * data.amount;
                });

                var score = totalAmount !== 0 ? weightedDays / totalAmount : 0;
                var label = 'within due date';
                if (score > 0) label = 'average late';
                else if (score < 0) label = 'average early';

                return {
                    totalAmount: Math.round(totalAmount * 100) / 100,
                    scorePercent: parseFloat(score.toFixed(2)) / 10,
                    label: label,
                    weightedDays: weightedDays
                };
            }

            var openMetrics = calculateMetrics(openInvoices);
            var paidMetrics = calculateMetrics(paidInvoices);
            var averageScorePercent = (openMetrics.scorePercent + paidMetrics.scorePercent) / 2;

            var payScoreRecord = record.create({ type: 'customrecord_vs_pay_score', isDynamic: true });

            payScoreRecord.setValue({ fieldId: 'custrecord_vs_client_name', value: context.key });
            payScoreRecord.setValue({ fieldId: 'custrecord_vs_request_date', value: new Date() });

            payScoreRecord.setValue({ fieldId: 'custrecord_vs_sum_of_open_invoices', value: parseFloat(openMetrics.totalAmount.toFixed(2)) });
            payScoreRecord.setValue({ fieldId: 'custrecord_vs_open_pay_score_percentage', value: parseFloat(openMetrics.scorePercent.toFixed(2)) });
            payScoreRecord.setValue({ fieldId: 'custrecord_vs_open_payscore_result', value: openMetrics.label });

            payScoreRecord.setValue({ fieldId: 'custrecord_vs_sum_of_paid_invoices', value: parseFloat(paidMetrics.totalAmount.toFixed(2)) });
            payScoreRecord.setValue({ fieldId: 'custrecord_vs_paid_pay_score_percentage', value: parseFloat(paidMetrics.scorePercent.toFixed(2)) });
            payScoreRecord.setValue({ fieldId: 'custrecord_vs_paid_payscore_result', value: paidMetrics.label });
            payScoreRecord.setValue({ fieldId: 'custrecord_vs_invoices_amount', value: parseFloat((openMetrics.totalAmount + paidMetrics.totalAmount).toFixed(2)) });
            payScoreRecord.setValue({ fieldId: 'custrecord_vs_average_pay_score_percent', value: parseFloat(averageScorePercent.toFixed(2)) });
            var invoiceMap = {};

            clientDataArray.forEach(function (data) {
                var invoiceId = data.invoice;
                if (!invoiceId) return;

                var currentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();

                if (!invoiceMap[invoiceId]) {
                    invoiceMap[invoiceId] = data;
                } else {
                    var existingDate = invoiceMap[invoiceId].paymentDate ? new Date(invoiceMap[invoiceId].paymentDate) : new Date('2000-01-01');
                    if (currentDate > existingDate) {
                        invoiceMap[invoiceId] = data;
                    }
                }
            });

            Object.values(invoiceMap).forEach(function (data) {
                payScoreRecord.selectNewLine({ sublistId: 'recmachcustrecord_vs_pay_score_parent' });
                payScoreRecord.setCurrentSublistValue({ sublistId: 'recmachcustrecord_vs_pay_score_parent', fieldId: 'custrecord_vs_invoice_id', value: data.invoice });

                if (data.trandate) {
                    payScoreRecord.setCurrentSublistValue({ sublistId: 'recmachcustrecord_vs_pay_score_parent', fieldId: 'custrecord_vs_invoice_date', value: data.trandate });
                }

                payScoreRecord.setCurrentSublistValue({ sublistId: 'recmachcustrecord_vs_pay_score_parent', fieldId: 'custrecord_vs_invoice_amount', value: parseFloat(data.amount.toFixed(2)) });
                if (data.duedate) {
                    payScoreRecord.setCurrentSublistValue({ sublistId: 'recmachcustrecord_vs_pay_score_parent', fieldId: 'custrecord_vs_invoice_due_date', value: data.duedate });
                }

                payScoreRecord.setCurrentSublistValue({ sublistId: 'recmachcustrecord_vs_pay_score_parent', fieldId: 'custrecord_vs_days_early_late', value: parseFloat(data.daysEarlyLate.toFixed(2)) });
                payScoreRecord.setCurrentSublistValue({ sublistId: 'recmachcustrecord_vs_pay_score_parent', fieldId: 'custrecord_vs_invoice_days', value: parseFloat((data.daysEarlyLate * data.amount).toFixed(2)) });
                payScoreRecord.setCurrentSublistText({ sublistId: 'recmachcustrecord_vs_pay_score_parent', fieldId: 'custrecord_vs_payment_date', text: data.paymentDate });
                payScoreRecord.setCurrentSublistValue({ sublistId: 'recmachcustrecord_vs_pay_score_parent', fieldId: 'custrecord_vs_invoice_status', value: data.status || '' });

                payScoreRecord.commitLine({ sublistId: 'recmachcustrecord_vs_pay_score_parent' });
            });

            var recordId = payScoreRecord.save();

            var customerRecord = record.load({ type: 'customer', id: context.key, isDynamic: true });

            customerRecord.setValue({ fieldId: 'custentity_vs_pay_score', value: parseFloat(paidMetrics.scorePercent.toFixed(2)) });
            customerRecord.setValue({ fieldId: 'custentity_vs_open_pay_score', value: parseFloat(openMetrics.scorePercent.toFixed(2)) });
            customerRecord.setValue({ fieldId: 'custentity_vs_average_pay_score', value: parseFloat(averageScorePercent.toFixed(2)) });

            customerRecord.save();
            log.debug({
                title: 'Pay Score Summary',
                details: {
                    recordId: recordId,
                    clientId: context.key,
                    openInvoiceTotal: openMetrics.totalAmount,
                    openPayScorePercent: openMetrics.scorePercent,
                    openPayScoreLabel: openMetrics.label,
                    paidInvoiceTotal: paidMetrics.totalAmount,
                    paidPayScorePercent: paidMetrics.scorePercent,
                    paidPayScoreLabel: paidMetrics.label,
                    totalInvoiceDays: (openMetrics.weightedDays + paidMetrics.weightedDays).toFixed(2),
                    averagePayScorePercent: averageScorePercent
                }
            });

            log.debug({ title: 'Pay Score Record Created with Lines', details: 'Record ID: ' + recordId + ', Client: ' + context.key });

        } catch (error) {
            log.error({
                title: 'Error in Reduce Stage',
                details: error.toString()
            });
        }
    }

    function formatToDate(dateString) {
        if (!dateString) return new Date(); // fallback to today

        // dateString is expected to be in 'YYYY-MM-DD'
        var parts = dateString.split('-');
        if (parts.length !== 3) return new Date();

        var year = parseInt(parts[0], 10);
        var month = parseInt(parts[1], 10) - 1; // month is zero-indexed
        var day = parseInt(parts[2], 10);

        return new Date(year, month, day);
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce
    };
});
