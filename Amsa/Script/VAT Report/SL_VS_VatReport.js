/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/http', 'N/search','N/ui/serverWidget','N/render','N/email','N/file'], function(http, search,serverWidget,render,file,email) {

    function onRequest(context) {
        if (context.request.method === 'GET') {
   
            var startDate = context.request.parameters.custparam_start_date;
            var endDate = context.request.parameters.custparam_end_date;
            var subsidiary = context.request.parameters.custparam_subsidiary;

            // Fetch the subsidiary name using search.lookupFields
            var subsidiaryName = search.lookupFields({
                type: 'subsidiary',
                id: subsidiary,
                columns: ['name']
            }).name;
   
            var salesTransactions = search.create({
                type: "transaction",
                settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],             
                filters:
                [
                   ["mainline","any",""], 
                   "AND", 
                   ["type","anyof","CustCred","CustInvc","Journal"], 
                   "AND", 
                   ["posting","is","T"], 
                   "AND", 
                   ["taxitem","noneof","@NONE@"], 
                   "AND", 
                   ["accounttype","anyof","Income","OthIncome","FixedAsset","OthAsset"], 
                   "AND", 
                   ["trandate","onorafter",startDate], 
                   "AND", 
                   ["trandate","onorbefore",endDate],
                   "AND", 
                   ["subsidiary","anyof",subsidiary]
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
                    name: "formulanumeric",
                    summary: "SUM",
                    formula: "({taxamount}*-1)",
                    label: "Total Tax"
                 })
                ]
             });
   
             var salesResults = salesTransactions.run().getRange({
                start: 0,
                end: 100 // Adjust as needed
            });

            var purchaseTransaction = search.create({
               type: "transaction",
               settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
               filters:
               [
                ["mainline","any",""], 
                "AND", 
                ["accounttype","anyof","FixedAsset","OthAsset","OthCurrLiab","Expense","OthExpense","OthCurrAsset"], 
                "AND", 
                ["type","anyof","VendBill","VendCred","Journal"], 
                "AND", 
                ["posting","is","T"], 
                "AND", 
                [["taxitem","noneof","@NONE@"],"OR",["account","anyof","211"]],          
                "AND", 
                ["trandate","onorafter",startDate], 
                "AND", 
                ["trandate","onorbefore",endDate],
                "AND", 
                ["subsidiary","anyof",subsidiary]
               ],
               columns:
               [
                search.createColumn({
                    name: "formulanumeric1",
                    summary: "SUM",
                    formula: "(CASE WHEN {taxitem} IS NOT NULL THEN (case when{type}='Journal' then ABS({amount}) else {amount} end)  WHEN {taxitem} IS NULL AND {account.id} =211 then {amount}*(100/15)+0.0001 ELSE NULL END)",
                    label: "Formula (Numeric)"
                 }),
                //  search.createColumn({
                //     name: "taxcode",
                //     summary: "GROUP",
                //     label: "Tax Item"
                //  }),
                 search.createColumn({
                    name: "formulatext",
                    summary: "GROUP",
                    formula: "(CASE WHEN {taxitem} IS NOT NULL THEN {taxitem}  WHEN {taxitem} IS NULL AND {account.id} =211 then 'Standard Vat - 15%' ELSE NULL END)",
                    label: "Tax Item"
                 }),
           
                 search.createColumn({
                    name: "formulanumeric",
                    summary: "SUM",
                    formula: "(CASE WHEN {taxitem} IS NOT NULL THEN ({taxamount}*-1)  WHEN {taxitem} IS NULL AND {account.id} =211 then {amount} ELSE NULL END)",
                    label: "Total Tax"
                 })
               ]
            });
   
            var expenseResults = purchaseTransaction.run().getRange({
                start: 0,
                end: 100
            });
   
            // Prepare HTML to fill in the dataf
          var html = '<?xml version="1.0"?><!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd"><pdf>';
          html += '<body><h1 align = "center" text-align = "center">VAT Report</h1><p><b>Company name:</b> Amsa Hospitality</p><br/>';
          html += '<b>From:</b> '+startDate;
          html += '<br/><b>To:</b> '+endDate;
          html += '<br/><b>Subsidiary:</b>' + subsidiaryName;
          html += '<h1 style="text-align: center;">Sales</h1><table border="1" style="width: 100%;"><tr><th><b>Description</b></th><th><b>Amount</b></th><th><b>Adjustment</b></th><th><b>VAT</b></th></tr>';
                    
            // Loop through sales search results and build HTML table rows
            salesResults.forEach(function(result) {
                html += '<tr>';
                var name = result.getValue({ name: 'name', join: 'taxItem', summary: 'GROUP' });
                var amount = result.getValue({ name: 'amount', summary: 'SUM' });
            
                // Replace name with "Standard rated domestic sales"
                if (name === 'S-KSA') {
                    name = '1) Standard rated domestic sales';
                }
            
                html += '<td>' + name + '</td>';
                html += '<td style="text-align: center;">' + amount + '</td>';
                html += '<td style="text-align: center;">0.00</td>';
                html += '<td style="text-align: center;">' + result.getValue({ name: 'formulanumeric', summary: 'SUM' }) + '</td>';
                
                html += '</tr>';
            });
            var totalAmountSales = 0;
            salesResults.forEach(function(result) {
            totalAmountSales += parseFloat(result.getValue({ name: 'amount', summary: 'SUM' }));
            });
   
            var totalTaxSales = 0;
   
            // Iterate through the salesResults array
            for (var i = 0; i < salesResults.length; i++) {
                // Get the value of the "Total Tax Sales" column from each result
                var taxSalesValue = salesResults[i].getValue({
                    name: 'formulanumeric',
                    summary: 'SUM'
                });
   
                // Add the value to the totalTaxSales variable
                totalTaxSales += parseFloat(taxSalesValue || 0); // Ensure value is parsed as a float, handle cases where value is null or undefined
            }
            // Add four empty rows manually
            html += '<tr><td>1) Standard Rated Domestic Sales</td><td style="text-align: center;">0.00</td><td align = "center">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>2) Private Healthcare / Private Education / First house sales to citizens</td><td style="text-align: center;">0.00</td><td align = "center">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>3) Zero Rated domestic sales</td><td style="text-align: center;">0.00</td><td align = "center">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>4) Zero rated exports</td><td style="text-align: center;">0.00</td><td align = "center">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>5) Exempt Sales</td><td style="text-align: center;">0.00</td><td align = "center">0.00</td><td style="text-align: center;">0.00</td></tr>';
           
            html += '<tr><td style="text-align: right;"><b>6) Total Sales:</b></td><td style="text-align: center;"><b>' + Number(totalAmountSales).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + '</b></td><td style="align: center; text-align: right;">0.00</td><td style="text-align: center;"><b>' + Number(totalTaxSales).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + '</b></td></tr>';
   
            html += '</table>';
   
   
   // Initialize an array to hold the rows in the correct order
   var rows = [];
   
   // Define an object to hold the order of the descriptions
   var descriptionOrder = {
    '7) Standard Rated Domestic Purchases': 7,
    '8) Imports Subject to VAT paid at customs': 8,
    '9) Imports Subject to VAT accounted (the reverse charge mechanism)': 9,
    '10) Zero Rated Purchases': 10,
    '11) Exempt Purchases': 11
   };
   
   // Object to track if a description has already been added
   var addedDescriptions = {};
   
   // Loop through expense search results and build the rows
   expenseResults.forEach(function(result) {
    // var name = result.getText({ name: 'formulatext', summary: 'GROUP' });
    var name = result.getValue({
        name: "formulatext",
        summary: "GROUP"
    });
    var amount = result.getValue({ name: 'formulanumeric1', summary: 'SUM' });
    var vatAmount = parseFloat(result.getValue({ name: 'formulanumeric', summary: 'SUM' }) || 0).toFixed(2);
   log.debug('name' , name);
    // Replace name based on conditions
    if (name === 'Standard Vat - 15%') {
        name = '7) Standard Rated Domestic Purchases';
    } else if (name === 'Vat - 0%') {
        name = '8) Exempt Purchases';
    }
   
    // Only add the row if the name hasn't been added before
    if (!addedDescriptions[name]) {
        rows.push({
            name: name,
            amount: amount,
            vatAmount: vatAmount,
            order: descriptionOrder[name] || 99 // Default order 99 for unknown descriptions
        });
        addedDescriptions[name] = true; // Mark the description as added
    }
   });
   
   // Sort rows based on the description order
   rows.sort(function(a, b) {
    return a.order - b.order; // Sort by the 'order' property to ensure correct display order
   });
   
   // Start building the HTML
   html += '<h1 style="text-align: center;">Purchase</h1><table border="1" style="width: 100%;"><tr><th><b>Description</b></th><th><b>Amount</b></th><th><b>Adjustment</b></th><th><b>VAT</b></th></tr>';
   
   // Loop through the sorted rows array and append to the HTML string
   rows.forEach(function(row) {
    html += '<tr>';
    html += '<td>' + row.name + '</td>';
    html += '<td style="text-align: center;">' + row.amount.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + '</td>';
    html += '<td style="text-align: center;">0.00</td>';
    html += '<td style="text-align: center;">' + row.vatAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ",")+ '</td>';
    html += '</tr>';
   });
   
   
   
   // PURCHASE
   // Continue with the rest of your static rows and summary calculations
   var totalAmountExpense = 0;
   expenseResults.forEach(function(result) {
    totalAmountExpense += parseFloat(result.getValue({ name: 'formulanumeric1', summary: 'SUM' }));
   });
   
   var totalAmount = totalAmountExpense + totalAmountSales;
   var totalTaxPurchase = 0;
   
   for (var i = 0; i < expenseResults.length; i++) {
    var taxPurchaseValue = expenseResults[i].getValue({
        name: 'formulanumeric',
        summary: 'SUM'
    });
    totalTaxPurchase += parseFloat(taxPurchaseValue || 0);
   }
   
   var totalTax = totalTaxSales - totalTaxPurchase;
   
   // Add the static rows
   html += '<tr><td>9) Imports Subject to VAT paid at customs</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td></tr>';
   html += '<tr><td>10) Imports Subject to VAT accounted (the reverse charge mechanism)</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td></tr>';
   html += '<tr><td>11) Zero Rated Purchases</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td></tr>';
   
   // Add the total purchase and VAT
   html += '<tr><td style="text-align: right;"><b>12) Total Purchase:</b></td><td style="text-align: center;"><b>' + Number(totalAmountExpense).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
   + '</b></td><td style="text-align: center;"><b>0.00</b></td><td style="align: center; text-align: right;"><b>'+ Number(totalTaxPurchase).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") +'</b></td></tr>'
   html += '<tr><td align = "right" text-align = "right"><b>13) Total Tax payable for current period</b></td><td colspan = "4" style="text-align: center;">'+ Number(totalTax).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") +'</td></tr>';
   html += '<tr><td align = "right" text-align = "right"><b>14) Corrections from previous period (up to 5,000 SAR)</b></td><td colspan = "4" style="text-align: center;">0.00</td></tr>';
   html += '<tr><td align = "right" text-align = "right"><b>15) Current Period VAT</b></td><td colspan = "4" style="text-align: center;">'+ Number(totalTax).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") +'</td></tr>';
   html += '</table></body></pdf>';
   
          
   var pdfFile = render.create();
        pdfFile.templateContent = html
   
   var pdf = pdfFile.renderAsPdf();
   
   context.response.renderPdf(html);
        
    
        }
    }
   
    return {
        onRequest: onRequest
    };
   });
   