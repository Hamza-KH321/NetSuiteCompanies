/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/search', 'N/runtime', 'N/log'], function (search, runtime, log) {

    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.CREATE) {
            return;
        }

        try {
            var rec = context.newRecord;
            var selectedWarehouseId = parseInt(rec.getValue({ fieldId: 'custrecord_vs_warehouse' }) || '', 10);

            if (!selectedWarehouseId || isNaN(selectedWarehouseId)) {
                return;
            }

            var currentUserId = runtime.getCurrentUser().id;
            var employeeLookup = search.lookupFields({
                type: 'employee',
                id: currentUserId,
                columns: ['department']
            });

            if (!employeeLookup || !employeeLookup.department || !employeeLookup.department.length) {
                throw new Error('Unable to read your department. Please contact the administrator.');
            }

            var departmentId = parseInt(employeeLookup.department[0].value, 10);
            log.debug('Resolved Area Location', { departmentId: departmentId });

            var errorMessage = '';

            if (departmentId === 2 && (selectedWarehouseId === 102 || selectedWarehouseId === 6)) {
                errorMessage = 'Area Location Central is not allowed to choose Warehouse "Goods held in trust by others" or "SFDA Warehouse".';
            } else if (departmentId === 3 && selectedWarehouseId !== 1) {
                errorMessage = 'Area Location Eastern may only choose Warehouse "Dammam".';
            } else if (departmentId === 1 && selectedWarehouseId !== 2) {
                errorMessage = 'Area Location Western may only choose Warehouse "Jeddah".';
            }

            if (errorMessage) {
                log.debug('Invalid Choice', { departmentId: departmentId, selectedWarehouseId: selectedWarehouseId });
                // Throwing a plain Error shows a red banner in the UI
                throw new Error(errorMessage);
            }

        } catch (e) {
            log.error('Validation Error', e);
            throw e; // rethrow so user sees red banner
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
