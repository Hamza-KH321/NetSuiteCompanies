/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log'], function(search, record, log) {

    function getInputData() {
        return search.create({
            type: "creditmemo",
            settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
            filters: [
                ["mainline", "is", "T"],
                "AND",
                ["custbody_vs_customercomplaint", "anyof", "@NONE@"],
                "AND",
                ["type", "anyof", "CustCred"],
                "AND",
                ["createdfrom", "noneof", "@NONE@"],
                // "AND",
                // ["internalid", "anyof", "815608"] // You can change this or remove it
            ],
            columns: [
                search.createColumn({ name: "internalid" }),
                search.createColumn({ name: "trandate" }),
                search.createColumn({ name: "custbody_vs_customercomplaint" }),
                search.createColumn({ name: "createdfrom" })
            ]
        });
    }

    function map(context) {
        try {
            var result = JSON.parse(context.value);
            var creditMemoId = result.id;

            log.debug('Processing Credit Memo ID', creditMemoId);

            // Load the Credit Memo to get createdfrom
            var creditMemoRec = record.load({
                type: record.Type.CREDIT_MEMO,
                id: creditMemoId,
                isDynamic: false
            });

            var createdFromId = creditMemoRec.getValue({ fieldId: 'createdfrom' });
            var createdFromText = creditMemoRec.getText({ fieldId: 'createdfrom' });

            if (createdFromText && createdFromText.startsWith('Return Authorisation')) {

                log.debug('Valid Return Authorization found', createdFromId);

                var returnAuthRec = record.load({
                    type: record.Type.RETURN_AUTHORIZATION,
                    id: createdFromId,
                    isDynamic: false
                });

                var complaintValue = returnAuthRec.getValue({
                    fieldId: 'custbody_vs_customercomplaint'
                });

                if (complaintValue) {
                    log.debug('Copying Complaint Value', complaintValue);

                    creditMemoRec.setValue({
                        fieldId: 'custbody_vs_customercomplaint',
                        value: complaintValue
                    });

                    creditMemoRec.save({ ignoreMandatoryFields: true });

                    log.audit('Updated Credit Memo', 'ID: ' + creditMemoId + ' with complaint value: ' + complaintValue);
                } else {
                    log.debug('Return Auth Complaint is empty', 'Skipping Credit Memo ID: ' + creditMemoId);
                }

            } else {
                log.debug('Not a Return Authorization', 'Skipping Credit Memo ID: ' + creditMemoId);
            }

        } catch (e) {
            log.error('Error processing Credit Memo ID ' + context.key, e.toString());
        }
    }

    return {
        getInputData: getInputData,
        map: map
    };

});
