/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/action', 'N/currentRecord'],
/**
 * @param{action} action
 * @param{currentRecord} currentRecord
 */
function(action, currentRecord) {

    /**
     * Function to be executed when field is changed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
     * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
     *
     * @since 2015.2
     */
    function fieldChanged(scriptContext) {
     // alert(scriptContext.fieldId)
        var status = scriptContext.currentRecord.getValue('orderstatus');
       // alert(status);
        if (status != 'A'){
         // alert('entered not A')

          if(scriptContext.fieldId == 'custcol_vs_createso')
             return true;
          
          // alert("you cannot add/Edit Sales Orders.")
            }
    }

    return {       
        fieldChanged: fieldChanged
    };
    
});
