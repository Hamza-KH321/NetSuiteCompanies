/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/format', 'N/record',, 'N/error', 'N/ui/message'],
/**
 * @param{currentRecord} currentRecord
 * @param{format} format
 * @param{record} record
 * @param{error} error
 * @param{error} message
 */
function(currentRecord, format, record, error, message) {

    /**
     * Validation function to be executed when record is saved.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @returns {boolean} Return true if record is valid
     *
     * @since 2015.2
     */
    function saveRecord(scriptContext) {
try{


  
        var customRecord = record.load({
            type: 'customrecord_vs_inventorytransactionlock',
            id: 2,
            isDynamic: true
        })

        var rec = scriptContext.currentRecord;
        var transactionDate = rec.getValue({ fieldId: 'trandate' }); 
        var startDate = customRecord.getValue({ fieldId: 'custrecord_vs_startdate' });
        var endDate = customRecord.getValue({ fieldId: 'custrecord_vs_endadate' });

        log.debug('transactionDate ' , transactionDate);
        log.debug('startDate ' , startDate);
        log.debug('endDate ' , endDate);
        // Formating Date to Day/Month/ Year 1/8/2023
        // var formattedDate1 = format.format({ value: transactionDate, type: format.Type.DATE });
        // var formattedDate2 = format.format({ value: startDate, type: format.Type.DATE });
        // var formattedDate3 = format.format({ value: endDate, type: format.Type.DATE });

        var formattedDate1 = new Date(format.format({ value: transactionDate, type: format.Type.DATE }));
        var formattedDate2 = new Date(format.format({ value: startDate, type: format.Type.DATE }));
        var formattedDate3 = new Date(format.format({ value: endDate, type: format.Type.DATE }));
        log.debug('formattedDate1 ' , formattedDate1);
        log.debug('formattedDate2 ' , formattedDate2);
        log.debug('formattedDate3 ' , formattedDate3);
        // var millisecond = (parseInt(formattedDate1.substring(0, 2)) +'/' +parseInt(formattedDate1.substring(2, 4)) +'/'+ (parseInt(formattedDate1.substring(4, 6))+2000));
        

        if(transactionDate >= startDate && transactionDate <= endDate)
        {
            log.debug({title: 'Test2',details: 'Transaction must be locked'});
            // throw new Error('you cannot add/Edit this Transaction because its Locked.');
            alert('you cannot Add/Edit this Transaction because its Locked.');  
            return false;                
        }
        else return true;
    }catch(e){
        
    }
}

    return {
        saveRecord: saveRecord
    };
    
});
