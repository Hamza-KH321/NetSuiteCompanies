/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function(record, log) {
    
    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.CREATE) {
            return;
        }
        
try {
            var newRecord = context.newRecord;
            var total = newRecord.getValue({ fieldId: 'total' });
    
            log.debug('Total Amount', total);
            
            var agencyFee = total * 0.15;
            
            log.debug('Agency Fee', agencyFee);
    
            newRecord.setValue({
                fieldId: 'custbody_vs_agencyfees',
                value: agencyFee
            });
    
            // Add new item to the item sublist
            var lineCount = newRecord.getLineCount({ sublistId: 'item' });
            newRecord.insertLine({
                sublistId: 'item',
                line: lineCount
            });
            newRecord.setSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: lineCount,
                value: 212
            });
            newRecord.setSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                line: lineCount,
                value: agencyFee
            });
} catch (error) {
    log.error('ERRORRRR!!!' , error);
}
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
