/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/format/i18n'],
/**
 * @param {i18n} i18n
 */
function(format) {
   
    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
     */
    function beforeLoad(scriptContext) {

    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function beforeSubmit(scriptContext) {
      
   		var rec = scriptContext.newRecord;
    	var total = String(rec.getValue('total'));
      
        //log.debug('total is '+total);
      
    	var num = total.split('.')[0];
    	var digit  = (total.split('.')[1]==undefined?'00':total.split('.')[1]);
    	if(digit.length == 1)
         	digit = digit+'0';
      
    	//log.debug('num is '+num+' and digit is '+digit);
    	
        var spellOutNum = format.spellOut({
            number: Number(num),
            locale: "EN"
        });
    	
        var spellOutDigit = format.spellOut({
            number: Number(digit),
            locale: "EN"
        });

        if(Number(digit)!=0)
        {
        digit = format.spellOut({
            number: Number(digit),
            locale: "EN"
        });
    }
      log.debug(spellOutNum+' and '+digit+'/100 only');
      
      if(Number(digit)!=0)
        rec.setValue({fieldId:'custbody_vs_amt_in_words',value:spellOutNum+' and '+digit});
      else
        rec.setValue({fieldId:'custbody_vs_amt_in_words',value:spellOutNum});
    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function afterSubmit(scriptContext) {

 
    	
    }

    return {
        beforeSubmit: beforeSubmit
    };
    
});
