/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || PO BD Manager Approval
 */
define(['N/log', 'N/search'], function (log, search) {

    function beforeSubmit(scriptContext) {
        try {
            var newRecord = scriptContext.newRecord;

            // Get class display from first item line
            var classDisplay = newRecord.getSublistValue({
                sublistId: 'item',
                line: 0,
                fieldId: 'class_display'
            });

            if (classDisplay) {
                var classType = classDisplay.split(':')[0].trim();
                newRecord.setValue({ fieldId: 'custbody_vs_po_class_type', value: classType });
                log.debug('Class Type Set', classType);
            }

            var location = newRecord.getValue({ fieldId: 'location' });
            var poClassType = newRecord.getValue({ fieldId: 'custbody_vs_po_class_type' });

            log.debug('Initial Values', { location: location, poClassType: poClassType });

            if (!poClassType) {
                log.debug('Exit Script', 'PO Class Type is empty, skipping logic');
                return;
            }

            var bdManagers = [];

            if (location == 2 || location == 17) { // Jeddah and Smart basket jeddah WH
                if (poClassType === 'Non Pharma') bdManagers = [209120, 425160]; // 425160 ahmad saleh , 379964 Rawan, 421041 omar baker
                else if (poClassType === 'Pharma') bdManagers = [146766]; // sheta 146766
                else if (poClassType === 'Medical') bdManagers = [425160];
                else if (poClassType === 'Animal Health') bdManagers = [501399];
                else if (poClassType === 'Private Label') bdManagers = [209120];
            }
            else if (location == 1) { // Riyadh
                if (poClassType === 'Non Pharma' || poClassType === 'Pharma' || poClassType === 'Medical') {
                    bdManagers = [425366, 255065];
                }
                else if (poClassType === 'Animal Health') bdManagers = [501399];
                else if (poClassType === 'Private Lable') bdManagers = [209120];
            }

            // ===========================
            // ADDITIONAL LOGIC (DO NOT CHANGE EXISTING)
            // ===========================
            var total = newRecord.getValue({ fieldId: 'total' });
            log.debug('PO Total', total);

            if (location == 2 && total < 50000 && (poClassType === 'Non Pharma' || poClassType === 'Pharma' || poClassType === 'Medical')) {

                if (bdManagers.indexOf(468421) == -1) { // sE-241 Ibrahim Elmekabaty 468421
                    bdManagers.push(468421);
                    log.debug('Added Extra BD Manager (Low Total)', 468421);
                }
            }

            log.debug('BD Managers', bdManagers);

            if (bdManagers.length > 0) {

                newRecord.setValue({ fieldId: 'custbody_vs_bd_manager', value: bdManagers[0] });

                if (bdManagers.length > 1) {
                    newRecord.setValue({ fieldId: 'custbody_vs_bs_manager_1', value: bdManagers[1] });
                }

                if (bdManagers.length > 2) {
                    newRecord.setValue({ fieldId: 'custbody_vs_bd_manager_2', value: bdManagers[2] });
                }

                var employeeSearch = search.create({
                    type: search.Type.EMPLOYEE,
                    filters: [
                        ['internalid', 'anyof', bdManagers]
                    ],
                    columns: ['email']
                });

                var bdEmails = [];

                employeeSearch.run().each(function (result) {
                    var email = result.getValue({ name: 'email' });
                    if (email) {
                        bdEmails.push(email);
                    }
                    return true;
                });

                if (bdEmails.length > 0) {
                    var emailString = bdEmails.join(',');
                    newRecord.setValue({ fieldId: 'custbody_vs_bd_manager_email', value: emailString });
                    log.debug('BD Manager Emails', emailString);
                }
            }

        } catch (e) {
            log.error('Error in beforeSubmit', e);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});