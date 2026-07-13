/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/http', 'N/search'], function(http, search) {

    function onRequest(context) {
        if (context.request.method === 'GET') {
            // Load your saved searches
            var salesTransactions = search.create({
                type: "transaction",
                filters:
                [
                   ["mainline","is","F"], 
                   "AND", 
                   ["accounttype","anyof","AcctRec","Income"]
                ],
                columns:
                [
                   search.createColumn({
                      name: "amount",
                      summary: "SUM",
                      label: "Amount"
                   }),
                   search.createColumn({
                      name: "name",
                      join: "taxItem",
                      summary: "GROUP",
                      sort: search.Sort.ASC,
                      label: "Name"
                   }),
                   search.createColumn({
                      name: "accounttype",
                      summary: "GROUP",
                      label: "Account Type"
                   }),
                   search.createColumn({
                      name: "formulacurrency",
                      summary: "SUM",
                      formula: "{amount}*{taxitem.rate} * .1",
                      label: "Formula (Currency)"
                   })
                ]
             });

             var salesResults = salesTransactions.run().getRange({
                start: 0,
                end: 100 // Adjust as needed
            });

            var purchaseTransaction = search.create({
                type: "transaction",
                filters:
                [
                   ["mainline","is","F"], 
                   "AND", 
                   ["accounttype","anyof","Expense","OthExpense"]
                ],
                columns:
                [
                   search.createColumn({
                      name: "amount",
                      summary: "SUM",
                      label: "Amount"
                   }),
                   search.createColumn({
                      name: "name",
                      join: "taxItem",
                      summary: "GROUP",
                      sort: search.Sort.ASC,
                      label: "Name"
                   }),
                   search.createColumn({
                      name: "accounttype",
                      summary: "GROUP",
                      label: "Account Type"
                   }),
                   search.createColumn({
                      name: "formulacurrency",
                      summary: "SUM",
                      formula: "{amount}*{taxitem.rate} * .1",
                      label: "Formula (Currency)"
                   })
                ]
             });

            var expenseResults = purchaseTransaction.run().getRange({
                start: 0,
                end: 100 // Adjust as needed
            });

            // Prepare HTML to fill in the data
            var html = '<html><body><h1 style="text-align: center;">VAT Report - Sales Transactions</h1><table border="1" style="width: 100%;"><tr><th>Name</th><th>Account</th><th>Amount</th><th>Formula (Currency)</th></tr>';
                    
            // Loop through sales search results and build HTML table rows
            salesResults.forEach(function(result) {
                html += '<tr>';
                var name = result.getValue({ name: 'name', join: 'taxItem', summary: 'GROUP' });
                var amount = result.getValue({ name: 'amount', summary: 'SUM' });
            
                // Replace name with "Standard rated domestic sales"
                if (name === 'S-KSA') {
                    name = 'Standard rated domestic sales';
                }
            
                html += '<td>' + name + '</td>';
                html += '<td style="text-align: center;">' + result.getValue({ name: 'accounttype', summary: 'GROUP' }) + '</td>';
                html += '<td style="text-align: center;">' + amount + '</td>';
                html += '<td style="text-align: center;">' + result.getValue({ name: 'formulacurrency', summary: 'SUM' }) + '</td>';
                html += '</tr>';
            });
            var totalAmountSales = 0;
            salesResults.forEach(function(result) {
            totalAmountSales += parseFloat(result.getValue({ name: 'amount', summary: 'SUM' }));
            });
            // Add four empty rows manually
            html += '<tr><td>Private Healthcare / Private Education / First house sales to citizens</td><td style="text-align: center;">Income</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>Zero Rated domestic sales</td><td style="text-align: center;">Income</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>Zero rated exports</td><td style="text-align: center;">Income</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>Exempt Sales</td><td style="text-align: center;">Income</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td colspan="2" style="text-align: right;"><b>Total:</b></td><td style="text-align: center;"><b>' + totalAmountSales.toFixed(2) + '</b></td><td style="text-align: center;">-</td></tr>';

            html += '</table>';

            // Prepare HTML for expense transactions
            html += '<h1 style="text-align: center;">VAT Report - Expense Transactions</h1><table border="1" style="width: 100%;"><tr><th>Name</th><th>Account</th><th>Amount</th><th>Formula (Currency)</th></tr>';

            // Loop through expense search results and build HTML table rows
            expenseResults.forEach(function(result) {
                html += '<tr>';
                var name = result.getValue({ name: 'name', join: 'taxItem', summary: 'GROUP' });
                var amount = result.getValue({ name: 'amount', summary: 'SUM' });
            
                // Replace name with "Standard rated domestic sales"
                if (name === 'S-KSA') {
                    name = 'Standard Rated Domestic Purchases';
                }
            
                html += '<td>' + name + '</td>';
                html += '<td style="text-align: center;">' + result.getValue({ name: 'accounttype', summary: 'GROUP' }) + '</td>';
                html += '<td style="text-align: center;">' + amount + '</td>';
                html += '<td style="text-align: center;">' + result.getValue({ name: 'formulacurrency', summary: 'SUM' }) + '</td>';
                html += '</tr>';
            });
            var totalAmountExpense = 0;
            expenseResults.forEach(function(result) {
                totalAmountExpense += parseFloat(result.getValue({ name: 'amount', summary: 'SUM' }));
            });
            // Add four empty rows manually
            html += '<tr><td>Imports Subject to VAT paid at customs</td><td style="text-align: center;">Exepnse</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>Imports Subject to VAT accounted (the reverse charge mehanism)</td><td style="text-align: center;">Income</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>Zero Rated Purchases</td><td style="text-align: center;">Expense</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>Exempt Purchases</td><td style="text-align: center;">Exepnse</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td colspan="2" style="text-align: right;"><b>Total:</b></td><td style="text-align: center;"><b>' + totalAmountExpense.toFixed(2) + '</b></td><td style="text-align: center;">-</td></tr>';

            html += '</table>';


            // Write the HTML response
            context.response.write(html);
        }
    }

    return {
        onRequest: onRequest
    };
});
