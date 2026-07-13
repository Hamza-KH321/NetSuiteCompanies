/**
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/search'], function (s) {

   // Client Script global variables.
   var allowSave = true;
   var firstItemNegative = false;
   var firstItemParentID = -9999;

   function fieldChanged(context) {

      var currentRecord = context.currentRecord;    // Current opened record.
      var sublistName = context.sublistId;          // The internal ID of the sublist.
      var sublistFieldName = context.fieldId;       // The internal ID of the field that was changed.
      var currentLine = context.line;               // Line number (first line has value = 0) of Item User is on.

      // Run when the Item field of the inventory sublist changed.
      // Item for some reason does not fire a change event, so using item description instead.
      // This means the description has to be required for these types of items.
      if (sublistName === 'inventory' && sublistFieldName === 'description') {

         // Check how many lines exist in the inventory sublist.
         var lines = currentRecord.getLineCount({sublistId: 'inventory'});
         // console.info("SS lines: " + lines);

         // if (currentRecord.isDynamic) {
         //    console.info("SS isDynamic: true");   // currentRecord is Dynamic.
         // } else {
         //    console.info("SS isDynamic: false");
         // }

      // Run when the Adjust Qty. By field of the inventory sublist changed.
      } else if (sublistName === 'inventory' && sublistFieldName === 'adjustqtyby') {

         console.info("SS fieldChanged: " + (context.sublistId || "record") + "." + context.fieldId);
         console.info("SS currentLine: " + currentLine);

         // Check how many lines exist in the inventory sublist.
         var lines = currentRecord.getLineCount({sublistId: 'inventory'});
         console.info("SS lines: " + lines);

         var total;      // Total used to check whether sum of quantities is zero.
         var quantity;   // Used to hold quantity for current line item.

         for (var i = 0; i <= lines; i++) {

            // If we are on the first item line.
            if (i === 0) {

               if (i === currentLine) {
                  // Get the first item line's Adjust Qty. By field value.
                  // Note that the value could be invalid in which case 0 is used.
                  // For partially entered lines.
                  total = (parseFloat(currentRecord.getCurrentSublistValue({
                     sublistId: "inventory",
                     fieldId: "adjustqtyby"
                  })) || 0);
               } else {
                  // Get the first item line's Adjust Qty. By field value.
                  // For completed lines that have been Added.
                  total = (parseFloat(currentRecord.getSublistValue({
                     sublistId: "inventory",
                     fieldId: "adjustqtyby",
                     line: i
                  })) || 0);
               }
               console.info("SS total first line: " + total);

               // If the quantity of the first line is positive then this is a real Inventory Adjustment
               // and not a roll that was cut into smaller inventory.
               if (total >= 0) {
                  firstItemNegative = false;
               } else {
                  firstItemNegative = true;
               }

            } else if (i > 0) {   // For non-first lines.

               if (i === currentLine) {
                  // Get the current item line's Adjust Qty. By field value.
                  quantity = (parseFloat(currentRecord.getCurrentSublistValue({
                     sublistId: "inventory",
                     fieldId: "adjustqtyby"
                  })) || 0);
               } else {
                  // Get the current item line's Adjust Qty. By field value.
                  quantity = (parseFloat(currentRecord.getSublistValue({
                     sublistId: "inventory",
                     fieldId: "adjustqtyby",
                     line: i
                  })) || 0);
               }
               console.info("SS quantity: " + quantity);

               // If the first item is negative then we have to keep a running total of the quantities.
               if (firstItemNegative) {
                  total = total + quantity;
                  console.info("SS total other lines: " + total);
               } else {   // If the first item is positive we have to check that there are no other negative quantities.
                  if (quantity < 0) {
                     allowSave = false;
                     // Show modeless Netsuite banner message at top of screen that is replaced by subsequent messages.
                     // If you use the same id in the first parameter it will overwrite the message, if you supply a different id you will see new messages uniquely in the page.
                     showAlertBox(
                        "my_element_id",   // Dummy element id of alert.
                        "Error:",          // Message header.
                        'Inventory Item line number ' + (i + 1) + ' has a negative "Adjust Qty. By" field value. Negative values are only allowed for the first item.',
                        3,                 // Colour of alert: 0 - Success (green), 1 - Information (blue), 2 - Warning (yellow), 3 - Error (red)
                        "","","",""        // Not sure what this does.
                     );
                     break;
                  }
               }
            }   // if (i === 0)

         }   // for (var i = 0; i < lines + 1; i++)
         console.info("SS total end: " + total);

         // If the total of the quantities are not zero then error. Allow if only the first line exists.
         if (total !== 0 && lines !== 0) {
            allowSave = false;
            if (total < 0) {
               showAlertBox(
                  "my_element_id",   // Dummy element id of alert.
                  "Error:",          // Message header.
                  'Error: The total of the "Adjust Qty. By" fields must equal zero. You are under by ' + (-total),
                  3,                 // Colour of alert: 0 - Success (green), 1 - Information (blue), 2 - Warning (yellow), 3 - Error (red)
                  "","","",""        // Not sure what this does.
               );
            } else {
               showAlertBox(
                  "my_element_id",   // Dummy element id of alert.
                  "Error:",          // Message header.
                  'Error: The total of the "Adjust Qty. By" fields must equal zero. You are over by ' + total,
                  3,                 // Colour of alert: 0 - Success (green), 1 - Information (blue), 2 - Warning (yellow), 3 - Error (red)
                  "","","",""        // Not sure what this does.
               );
            }
         } else {
            allowSave = true;
         }

      }   //  if (sublistName === 'inventory' && sublistFieldName === 'description')

      // Clear any error messages to show that all fields validated.
      if (allowSave) {
         showAlertBox(
            "my_element_id",   // Dummy element id of alert.
            "Success:",          // Message header.
            'Validation passed.',
            0,                 // Colour of alert: 0 - Success (green), 1 - Information (blue), 2 - Warning (yellow), 3 - Error (red)
            "","","",""        // Not sure what this does.
         );
      }

   }   // fieldChanged
   function saveRecord() {
      // debugger;
      console.info("SS saveRecord");
      if (!allowSave) {
         alert("Error: Save failed. There are error messages at the top of the page.");
      }
      return allowSave;
   }   // saveRecord

   return {
      fieldChanged: fieldChanged,
      saveRecord: saveRecord
   };

});   // Define