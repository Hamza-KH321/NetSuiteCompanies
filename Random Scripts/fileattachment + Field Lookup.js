/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/file', 'N/search'], function(log, file, search) {

    function afterSubmit(context) {
        // Check if the script is executing in the correct context and record type
        if (context.type === context.UserEventType.CREATE || context.type === context.UserEventType.EDIT) {
            // Get the current record
try {
                var currentRecord = context.newRecord;
                
                // Get the value of the custom field "custbody_vs_fileattachment"
                // var fieldValue = currentRecord.getValue({
                //     fieldId: 'custbody_vs_fileattachment'
                // });
                var vendorID = currentRecord.getValue({
                    fieldId: 'entity'
                });
    
                var vendorPhone;
                var vendorFields = search.lookupFields({
                    type: search.Type.VENDOR,
                    id: vendorID, // Assuming vendorID contains the internal ID of the vendor record
                    columns: ['phone']
                });
                vendorPhone = vendorFields.phone;
                log.debug('Vendor Phone number is:', vendorPhone);
                log.debug('Vendor Fields is:', vendorFields);
} catch (error) {
    log.error('ERROR' , error);
}

            var fileRecord;
            try {
                fileRecord = file.load({
                    id: fieldValue
                });
            } catch (error) {
                log.error({
                    title: 'Error loading file',
                    details: error
                });
                return;
            }

            //Get the URL of the file
            var fileURL = fileRecord.url;

            log.debug({
                title: 'File URL',
                details: fileURL
            });

            // Log the field value
            log.debug({
                title: 'Custom Field Value',
                details: fieldValue
            });
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});
