/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search'], function(record, search) {

    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
            return;
        }

        var newRecord = context.newRecord;

        // Get field values from the record
        var employeeId = newRecord.getValue({ fieldId: 'custrecord_vs_ot_employee' });
        var totalHours = newRecord.getValue({ fieldId: 'custrecord_vs_totalhours' });
        var type = newRecord.getValue({ fieldId: 'custrecord_vs_ot_type' });

        // Determine rate based on the Type field
        var rate = 1; // Default rate
        if (type == 2) {
            rate = 1.5;
        }

        // Load the employee record to get the salary
        if (employeeId && totalHours) {
            var employeeRecord = record.load({type: record.Type.EMPLOYEE,id: employeeId});

            var salary = employeeRecord.getValue({ fieldId: 'custentity_vs_salary' });

            if (salary) {
                // Calculate the hourly rate: ((salary / 30) / 8) * rate
                var hourRate = ((salary / 30) / 8) * rate;

                // Calculate the amount: totalHours * hourRate
                var amount = totalHours * hourRate;

                // Round the amount to 2 decimal places
                var roundedAmount = parseFloat(amount.toFixed(2));

                // Set the rounded amount in the custrecord_vs_amount field
                newRecord.setValue({fieldId: 'custrecord_vs_amount',value: roundedAmount});
            }
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
