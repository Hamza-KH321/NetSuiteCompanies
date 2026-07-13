/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/search', 'N/log', 'N/record', 'N/file'], function(search, log, record, file) {

    function afterSubmit(context) {
        try {
            if (context.type === context.UserEventType.CREATE || context.type === context.UserEventType.EDIT) {

                var vendorPrepaymentRecord = context.newRecord;
                var poId = vendorPrepaymentRecord.getValue({ fieldId: 'purchaseorder' });

                if (poId) {
                    var purchaseorderSearchObj = search.create({
                        type: "purchaseorder",
                        filters: [
                            ["internalid", "anyof", poId],
                            "AND",
                            ["mainline", "is", "T"]
                        ],
                        columns: [
                            search.createColumn({
                                name: "folder",
                                join: "file",
                                label: "Folder"
                            }),
                            search.createColumn({
                                name: "internalid",
                                join: "file",
                                label: "Internal ID"
                            })
                        ]
                    });

                    var attachedFiles = [];

                    purchaseorderSearchObj.run().each(function(result) {
                        var fileId = result.getValue({ name: "internalid", join: "file" });
                        
                        attachedFiles.push(fileId);

                        return true;
                    });

                    attachedFiles.forEach(function(fileId) {
                        record.attach({
                            record: {
                                type: 'file',
                                id: fileId
                            },
                            to: {
                                type: 'vendorprepayment',
                                id: vendorPrepaymentRecord.id
                            }
                        });

                        log.debug('File Attached', 'File ID ' + fileId + ' attached to Vendor Prepayment');
                    });

                } else {
                    log.debug('No Purchase Order', 'No Purchase Order associated with this Vendor Prepayment');
                }
            }
        } catch (e) {
            log.error('Error in afterSubmit', e.message);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
