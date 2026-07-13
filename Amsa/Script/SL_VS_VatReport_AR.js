/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/http', 'N/search'], function(http, search) {

    function onRequest(context) {
        if (context.request.method === 'GET') {

            var startDate = context.request.parameters.custparam_start_date;
            var endDate = context.request.parameters.custparam_end_date;
            var subsidiary = context.request.parameters.custparam_subsidiary;
            var subsidiaryName = search.lookupFields({
                type: 'subsidiary',
                id: subsidiary,
                columns: ['name']
            }).name;

            log.debug('Start Date', startDate);
            log.debug('endDate', endDate);

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
                   ["accounttype","anyof","FixedAsset","OthAsset","Expense","OthExpense","OthCurrLiab"], 
                   "AND", 
                   ["type","anyof","VendBill","VendCred","Journal"], 
                   "AND", 
                   ["posting","is","T"], 
                   "AND", 
                   ["taxitem","noneof","@NONE@"], 
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
                     formula: "case when{type}='Journal' then ABS({amount}) else {amount} end",
                     label: "Formula (Numeric)"
                  }),
                  search.createColumn({
                     name: "taxcode",
                     summary: "GROUP",
                     label: "Tax Item"
                  }),
                   search.createColumn({
                     name: "formulanumeric",
                     summary: "SUM",
                     formula: "({taxamount}*-1)",
                     label: "Total Tax"
                  })
                ]
             });

            var expenseResults = purchaseTransaction.run().getRange({
                start: 0,
                end: 100
            });

            // Prepare HTML to fill in the data
            var html = '<html><body>';
            
            // Add company info, dates, and subsidiary
            html += '<h1 align = "center" text-align = "center">تقرير ضريبة القيمة المضافة</h1>';
            html += '<p><b>Company name:</b> Amsa Hospitality</p><br/>';
            html += '<b>From:</b> ' + startDate;
            html += '<br/><b>To:</b> ' + endDate;
            html += '<br/><b>Subsidiary:</b> '+ subsidiaryName;

            // Start Sales section
            html += '<h1 style="text-align: center;">مبيعات</h1><table border="1" style="width: 100%;" dir="rtl"><tr><th>الوصف</th><th>المبلغ</th><th>التعديلات</th><th>ضريبة القيمة المضافة</th></tr>';
                    
            // Loop through sales search results and build HTML table rows
            salesResults.forEach(function(result) {
                html += '<tr>';
                var name = result.getValue({ name: 'name', join: 'taxItem', summary: 'GROUP' });
                var amount = result.getValue({ name: 'amount', summary: 'SUM' });
            
                // Replace name with "Standard rated domestic sales"
                if (name === 'S-KSA') {
                    name = ' 1) المبيعات الداخلية الخاضعة للنسبة الاساسية' ;
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
            html += '<tr><td>1) المبيعات الداخلية الخاضعة للنسبة الأساسية</td><td style="text-align: center;">0.00</td><td align = "center">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>2) المبيعات للمواطنين (الخدمات الصحية الخاصة/التعليم الاهلي الخاص/المسكن الاول)</td><td style="text-align: center;">0.00</td><td align = "center">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>3) مبيعات محلية خاضعة لنسبة الصفر</td><td style="text-align: center;">0.00</td><td align = "center">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>4) مبيعات التصدير الخاضعة لنسبة الصفر</td><td style="text-align: center;">0.00</td><td align = "center">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>5) مبيعات معفاة</td><td style="text-align: center;">0.00</td><td align = "center">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td colspan="1" style="text-align: right;"><b>6) اجمالي المبيعات:</b></td><td style="text-align: center;"><b>' + totalAmountSales.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + '</b></td><td style="text-align: center;"><b>0.00</b></td><td style="text-align: center;"><b>' + totalTaxSales.toFixed(2) + '</b></td></tr>';

            html += '</table>';

            // Prepare HTML for expense transactions
            html += '<h1 style="text-align: center;">مشتريات</h1><table border="1" style="width: 100%;" dir="rtl"><tr><th>الوصف</th><th>المبلغ</th><th>التعديلات</th><th>ضريبة القيمة المضافة</th></tr>';

            // Loop through expense search results and build HTML table rows
            expenseResults.forEach(function(result) {
                html += '<tr>';
                var name = result.getText({ name: 'taxcode', summary: 'GROUP' });
                var amount = parseFloat(result.getValue({ name: 'formulanumeric1', summary: 'SUM' }) || 0).toFixed(2);
                var vatAmount = parseFloat(result.getValue({ name: 'formulanumeric', summary: 'SUM' }) || 0).toFixed(2);
            

                // Replace name based on conditions
                if (name === 'Standard Vat - 15%') {
                    name = '7) مشتريات محلية خاضعة للنسبة الاساسية';
                } else if (name === 'Vat - 0%') {
                    name = '8) المشتريات المعفاة';
                }

                html += '<td>' + name + '</td>';
                html += '<td style="text-align: center;">' + amount.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + '</td>';
                html += '<td style="text-align: center;">0.00</td>';
                html += '<td style="text-align: center;">' + vatAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + '</td>';
                html += '</tr>';
            });
            var totalAmountExpense = 0;

            expenseResults.forEach(function(result) {
                totalAmountExpense += parseFloat(result.getValue({ name: 'amount', summary: 'SUM' }) || 0);
            });

            var totalAmount = totalAmountExpense + totalAmountSales;

            var totalTaxPurchase = 0;

            // Iterate through the salesResults array
            for (var i = 0; i < expenseResults.length; i++) {
                // Get the value of the "Total Tax Sales" column from each result
                var taxPurchaseValue = expenseResults[i].getValue({
                    name: 'formulanumeric',
                    summary: 'SUM'
                });

                // Add the value to the totalTaxSales variable
                totalTaxPurchase += parseFloat(taxPurchaseValue || 0); // Ensure value is parsed as a float, handle cases where value is null or undefined
            }
            var totalTax = totalTaxSales - totalTaxPurchase ;
            totalTax= parseFloat(totalTax || 0);
            // Add four empty rows manually
            html += '<tr><td>9) مشتريات مدفوعة عنها الضريبة في الجمارك</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>10) الضريبة على الواردات و الخاضعة لالية الاحتساب العكسي</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td>11) المشتريات الخاضعة لنسبة الصفر</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td><td style="text-align: center;">0.00</td></tr>';
            html += '<tr><td style="text-align: right;"><b>12) اجمالي المشتريات:</b></td><td style="text-align: center;"><b>' + Number(totalAmountExpense).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + '</b></td><td style="text-align: center;"><b>0.00</b></td><td style="text-align: center;"><b>'+ Number(totalTaxPurchase).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") +'</b></td></tr>';

            html += '<tr><td align = "right" text-align = "right"><b>13) اجمالي الضريبة المستحقة للفترة الحالية</b></td><td colspan = "3" style="text-align: center;">'+ ((totalTax < 0) ? Math.abs(Number(totalTax)).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")+"-":Number(totalTax).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")) +'</td></tr>';
            html += '<tr><td align = "right" text-align = "right"><b>14) تصحيحات الفترة السابقة حتى 5000 ريال سعودي</b></td><td colspan = "3" style="text-align: center;">0.00</td></tr>';
            html += '<tr><td align = "right" text-align = "right"><b>15) الضريبة المستحقة عن الفترة الحالية</b></td><td colspan = "3" style="text-align: center;">'+ ((totalTax < 0) ? Math.abs(Number(totalTax)).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")+"-":Number(totalTax).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")) +'</td></tr>';
            html += '</table>';

            // Write the HTML response
            context.response.write(html);
        }
    }

    return {
        onRequest: onRequest
    };
});
