/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/search', 'N/ui/dialog', 'N/currentRecord'], function (search, dialog, currentRecord) {

  function validateLine(context) {
      try {
          var currentRecord = context.currentRecord;
          var sublistName = context.sublistId;

          if (sublistName == 'expense') {
              var memoField = currentRecord.getCurrentSublistValue({
                  sublistId: 'expense',
                  fieldId: 'memo'
              });

              var categoryField = currentRecord.getCurrentSublistValue({
                  sublistId: 'expense',
                  fieldId: 'category'
              });

              if (memoField == '' && !memoField) {
                  alert('The Memo field is mandatory, Please enter value for Memo to complete');
                  return false; // Prevents saving the line or record
              }
              if (categoryField == '' && !categoryField) {
                  alert('The Category field is mandatory, Please enter value for Category to complete');
                  return false; // Prevents saving the line or record
              }
          }
      } catch (error) {
          console.error('ERROR!', error);
          return false;
      }

      return true; // Allows saving the line or record
  }

//   function lineInit(context) {
//     try {
//         var currentRecordObj = currentRecord.get();
//         var sublistName = context.sublistId;
        
//         // Check if the sublist is 'expense'
//         if (sublistName === 'expense') {
//             // Disable the tax1amt field for each line
//             var numLines = currentRecordObj.getLineCount({ sublistId: 'expense' });
//             for (var i = 0; i < numLines; i++) {
              
//                 currentRecordObj.setCurrentSublistField({
//                     sublistId: 'expense',
//                     fieldId: 'tax1amt',
//                     line: i,
//                     value: '',
//                     ignoreFieldChange: true
//                 }).isDisabled = true;
                
//                 currentRecordObj.setCurrentSublistField({
//                     sublistId: 'expense',
//                     fieldId: 'taxcode',
//                     line: i,
//                     value: '',
//                     ignoreFieldChange: true
//                 }).isDisabled = true;
                
//                 currentRecordObj.setCurrentSublistField({
//                     sublistId: 'expense',
//                     fieldId: 'taxrate1',
//                     line: i,
//                     value: '',
//                     ignoreFieldChange: true
//                 }).isDisabled = true;
//             }
//         }
//     } catch (error) {
//         console.error('Error in lineInit:', error);
//     }
    
//     return true;
//   }

  return {
      validateLine: validateLine
  };
});
