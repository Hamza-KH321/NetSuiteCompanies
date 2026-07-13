/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */

define(['N/search', 'N/currentRecord', 'N/log'], function (search, currentRecord, log) {

    function fieldChanged(context) {
        try {
            // Only Journal Entry line entity change
            if (context.sublistId !== 'line' || context.fieldId !== 'entity') {
                return;
            }

            var rec = currentRecord.get();

            var entityId = rec.getCurrentSublistValue({
                sublistId: 'line',
                fieldId: 'entity'
            });

            if (!entityId) {
                log.debug('Exit', 'No entity selected');
                return;
            }

            log.debug('Entity Selected', entityId);

            var employeeData;

            try {
                // 🔍 Try treating entity as Employee
                employeeData = search.lookupFields({
                    type: search.Type.EMPLOYEE,
                    id: entityId,
                    columns: ['location', 'department']
                });
            } catch (e) {
                // Not an employee record at all
                log.debug('Not Employee', 'Lookup failed for Employee record');
                return;
            }

            log.debug('Employee Lookup Result', employeeData);

            var locationId =
                employeeData.location && employeeData.location.length > 0
                    ? employeeData.location[0].value
                    : null;

            var departmentId =
                employeeData.department && employeeData.department.length > 0
                    ? employeeData.department[0].value
                    : null;

            // ❗ If no location AND no department → not an employee
            if (!locationId && !departmentId) {
                log.debug('Exit', 'No location and no department – not an employee');
                return;
            }

            // Set location if exists
            if (locationId) {
                rec.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'location',
                    value: locationId,
                    ignoreFieldChange: true
                });
                log.debug('Location Set', locationId);
            }

            // Set department if exists
            if (departmentId) {
                rec.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'department',
                    value: departmentId,
                    ignoreFieldChange: true
                });
                log.debug('Department Set', departmentId);
            }

        } catch (e) {
            log.error({
                title: 'JE Entity Employee Detection Error',
                details: e
            });
        }
    }

    return {
        fieldChanged: fieldChanged
    };
});
