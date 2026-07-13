/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/record', 'N/redirect', 'N/log'], function(ui, record, redirect, log) {

    function onRequest(context) {
        if (context.request.method === 'GET') {
            // Create the form for the UI
            var form = ui.createForm({
                title: 'Transaction Data Form'
            });

            // Add fields to the form
            var field = form.addField({
                id: 'custpage_transaction_field',
                type: ui.FieldType.TEXT,
                label: 'Enter Data'
            });
            
            form.addSubmitButton({
                label: 'Submit'
            });

            // Display the form
            context.response.writePage(form);
        } else {
            // Process the data from the form submission
            var submittedData = context.request.parameters.custpage_transaction_field;

            log.debug('Submitted Data:', submittedData);

            // Do something with the submitted data (e.g., update a record, calculate, etc.)

            // For now, returning the result as a JSON response
            var result = {
                message: 'You submitted: ' + submittedData
            };

                                     // if (window.opener) {
                                // Use window.opener to send the result back to the parent window
                              context.response.write('<script>window.opener.handleSuiteletResult(JSON.stringify(result))</script>');
                            //    window.close(); // Optionally, close the Suitelet window after sending the data
                        //    }

            // Send the result back as a JSON response
          var resp =                ' <html>'+
                 '   <head>'+
                       ' <script type="text/javascript">'+
                 '           if (window.opener || 1==1) {'+
                            '    // Use window.opener to send the result back to the parent window'+
             '                   window.opener.handleSuiteletResult(${JSON.stringify(result)});'+
                       '         window.close(); // Optionally, close the Suitelet window after sending the data'+
               '             }'+
               '         </script>'+
           '         </head>'+
         '           <body>Done</body>'+
           '     </html>';

          log.debug("resp ",resp)
          try{
           context.response.write(resp)
          }
          catch(e)
          {
            log.debug("dsadasda")
          }
        }
    }

    return {
        onRequest: onRequest
    };
});
