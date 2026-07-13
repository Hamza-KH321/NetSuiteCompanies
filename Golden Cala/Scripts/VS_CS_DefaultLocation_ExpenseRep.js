/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/record', 'N/search'], function(record, search) {

    function fieldChanged(context) {
        var currentRecord = context.currentRecord;
        var fieldName = context.fieldId;

        // Check if the changed field is 'entity'
        if (fieldName === 'entity') {
            var entityId = currentRecord.getValue({ fieldId: 'entity' });
            log.debug('Employe is: ' , entityId);

            if (entityId) {
                // Load the employee record
                try {
                    var employeeRecord = record.load({
                        type: record.Type.EMPLOYEE,
                        id: entityId
                    });

                    // Get the location from the employee record
                    var location = employeeRecord.getValue({ fieldId: 'location' });
                    log.debug('location is: ' , location);

                    // Set the location value in the custom field 'custbody_vs_employeelocation'
                    currentRecord.setValue({
                        fieldId: 'custbody_vs_employeelocation',
                        value: location
                    });
                } catch (e) {
                    console.error('Error loading employee record or setting location:', e);
                }
            } 
        }
    }

    return {
        fieldChanged: fieldChanged
    };
});
