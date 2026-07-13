/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/record', 'N/log'], function(record, log) {

    function pageInit(context) {
        var currentRecord = context.currentRecord;
        
        // Set the field 'custevent_vs_replymessageactiv' to false
        currentRecord.setValue({
            fieldId: 'custevent_vs_replymessageactiv',
            value: false
        });

        currentRecord.setValue({
            fieldId: 'emailform',
            value: false
        });

        currentRecord.setValue({
            fieldId: 'internalonly',
            value: true
        });

        log.debug({
            title: 'Page Init',
            details: 'Set field to false'
        });
    }

    function fieldChanged(context) {
        var currentRecord = context.currentRecord;
        var fieldId = context.fieldId;

        if (fieldId === 'outgoingmessage') {
            var outgoingMessage = currentRecord.getValue({ fieldId: 'outgoingmessage' });
        
            // Remove everything between < and > including the tags
            var cleanedMessage = outgoingMessage.replace(/<[^>]*>/g, '');
        
            currentRecord.setValue({
                fieldId: 'custevent_vs_reply2integrate',
                value: outgoingMessage
            });
        
            currentRecord.setValue({
                fieldId: 'custevent_vs_reply',
                value: cleanedMessage
            });
        
            currentRecord.setValue({
                fieldId: 'custevent_vs_replymessageactiv',
                value: true
            });
        
            log.debug({
                title: 'Field Changed - Outgoing Message',
                details: 'Outgoing Message: ' + outgoingMessage + ' | Cleaned Message: ' + cleanedMessage
            });
        }
    }

    return {
        fieldChanged: fieldChanged,
        pageInit:pageInit
    };
});
