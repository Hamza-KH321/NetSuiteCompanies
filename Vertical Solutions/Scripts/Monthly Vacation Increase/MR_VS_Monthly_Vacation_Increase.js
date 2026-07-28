/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {
        return search.create({
            type: "employee",
            filters: [["isinactive", "is", "F"],
                    //   "AND", 
                    //  ["internalid","anyof","286"]
                    ],
            columns: [
                search.createColumn({ name: "internalid", label: "Internal ID" }),
                search.createColumn({ name: "entityid", label: "Name" }),
                search.createColumn({ name: "custentity_vs_day", label: "21 Day" }),
                search.createColumn({ name: "custentity_vacation_days_emp", label: "Vacations Balance (Days)" }),
                search.createColumn({ name: "custentity_vacation_hours_emp", label: "Vacations Balance (Hours)" }),
                search.createColumn({ name: "custentity1", label: "Vacations Balance (Minutes)" })
            ]
        });
    }

    function map(context) {
        var employeeData = JSON.parse(context.value);
        var employeeId = employeeData.id;

        try {
            var employeeRecord = record.load({type: record.Type.EMPLOYEE,id: employeeId,isDynamic: true});

            var vacationDays = parseInt(employeeRecord.getValue('custentity_vacation_days_emp') || 0, 10);
            var vacationHours = parseInt(employeeRecord.getValue('custentity_vacation_hours_emp') || 0, 10);
            var vacationMinutes = parseInt(employeeRecord.getValue('custentity1') || 0, 10);
            var isChecked = employeeRecord.getValue('custentity_vs_day'); // Checkbox field

            if (isChecked) {
                vacationDays += 1;
                vacationHours += 6;
            } else {
                vacationDays += 1;
                vacationHours += 1;
                vacationMinutes += 20;
            }

            if (vacationMinutes > 59) {
                var extraHours = vacationMinutes / 60;
                vacationHours += extraHours;
                vacationMinutes -= extraHours * 60;
            } else if (vacationMinutes < -59) {
                var extraHours = vacationMinutes / 60;
                vacationHours += extraHours;
                vacationMinutes -= extraHours * 60;
            }

            if (vacationHours > 7) {
                var extraDays = vacationHours / 8;
                vacationDays += extraDays;
                vacationHours -= extraDays * 8;
            } else if (vacationHours < -7) {
                var extraDays = vacationHours / 8;
                vacationDays += extraDays;
                vacationHours -= extraDays * 8;
            }

            employeeRecord.setValue('custentity_vacation_days_emp', vacationDays);
            employeeRecord.setValue('custentity_vacation_hours_emp', vacationHours);
            employeeRecord.setValue('custentity1', vacationMinutes);
            employeeRecord.save();

            log.debug("Updated Employee", {
                employeeId: employeeId,
                vacationDays: vacationDays,
                vacationHours: vacationHours,
                vacationMinutes: vacationMinutes
            });

        } catch (error) {
            log.error("Error Processing Employee ID: " + employeeId, error);
        }
    }

    return {
        getInputData: getInputData,
        map: map
    };
});
