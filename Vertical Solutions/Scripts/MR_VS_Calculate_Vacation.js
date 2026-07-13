/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log', 'N/runtime'], function (search, record, log, runtime) {

    function getInputData() {
        var script = runtime.getCurrentScript();
        var fromDate = script.getParameter({ name: 'custscript_from_date' });
        var toDate = script.getParameter({ name: 'custscript_to_date' });

        log.debug('Date Range', 'From: ' + fromDate + ', To: ' + toDate);

        return search.create({
            type: "customrecordcustomrecord_vs_attendance",
            filters: [
                // ["custrecordcustrecord_vs_employee", "anyof", "286"],
                // "AND",
                ["formuladate: {custrecordcustrecord_vs_date_attendance}", "within", fromDate, toDate]
            ],
            columns: [
                search.createColumn({ name: "internalid", label: "Internal ID" }),
                search.createColumn({ name: "custrecordcustrecord_vs_employee", label: "Employee" }),
                search.createColumn({ name: "custrecordcustrecord_vs_absent", label: "Absent" }),
                search.createColumn({ name: "custrecord_vs_sick_leave", label: "Sick Leave" }),
                search.createColumn({
                    name: "formulatext",
                    formula: "FLOOR((CASE WHEN ({custrecordcustrecord_vs_late} + {custrecordcustrecord_vs_early}) > 10 THEN ({custrecordcustrecord_vs_late} + {custrecordcustrecord_vs_early}) ELSE 0 END) / 60) || ':' || LPAD(TO_CHAR(MOD((CASE WHEN ({custrecordcustrecord_vs_late} + {custrecordcustrecord_vs_early}) > 10 THEN ({custrecordcustrecord_vs_late} + {custrecordcustrecord_vs_early}) ELSE 0 END), 60)), 2, '0')",
                    label: "Total Delay and Leave"
                })
            ]
        });
    }

    function map(context) {
        var result = JSON.parse(context.value);
        context.write({
            key: result.id,
            value: {
                employeeId: result.values.custrecordcustrecord_vs_employee.value,
                absent: result.values.custrecordcustrecord_vs_absent,
                sickLeave: result.values.custrecord_vs_sick_leave,
                totalDelayAndLeave: result.values.formulatext
            }
        });
    }

    function reduce(context) {
        var lineData = JSON.parse(context.values[0]);
        var employeeId = lineData.employeeId;
    
        var employeeRecord = record.load({ type: record.Type.EMPLOYEE, id: employeeId });
    
        var vacationDays = employeeRecord.getValue('custentity_vacation_days_emp') || 0;
        var vacationHours = employeeRecord.getValue('custentity_vacation_hours_emp') || 0;
        var vacationMinutes = employeeRecord.getValue('custentity1') || 0;
        var sickLeaveDays = employeeRecord.getValue('custentity_sickleaho') || 0;
    
        vacationDays = parseInt(vacationDays, 10);
        vacationHours = parseInt(vacationHours, 10);
        vacationMinutes = parseInt(vacationMinutes, 10);

        if (lineData.sickLeave === 'T') {
            sickLeaveDays -= 1;
        }
    
        if (lineData.absent === 'T') {
            vacationDays -= 1;
        } else {
            var totalDelayAndLeave = lineData.totalDelayAndLeave;
            if (totalDelayAndLeave !== '0:00') {
                var delayParts = totalDelayAndLeave.split(':');
                var delayHours = parseInt(delayParts[0], 10);
                var delayMinutes = parseInt(delayParts[1], 10);
    
                vacationMinutes -= delayMinutes;
                vacationHours -= delayHours;
            }
        }

        if (vacationMinutes > 59) {
            var extraHours = Math.floor(vacationMinutes / 60);
            vacationHours += extraHours;
            vacationMinutes -= extraHours * 60;
        } else if (vacationMinutes < -59) {
            var extraHours = Math.ceil(vacationMinutes / 60);
            vacationHours += extraHours;
            vacationMinutes -= extraHours * 60;
        }
    
        if (vacationHours > 7) {
            var extraDays = Math.floor(vacationHours / 8);
            vacationDays += extraDays;
            vacationHours -= extraDays * 8;
        } else if (vacationHours < -7) {
            var extraDays = Math.ceil(vacationHours / 8);
            vacationDays += extraDays;
            vacationHours -= extraDays * 8;
        }
    
        employeeRecord.setValue('custentity_vacation_days_emp', vacationDays);
        employeeRecord.setValue('custentity_vacation_hours_emp', vacationHours);
        employeeRecord.setValue('custentity1', vacationMinutes);
        employeeRecord.setValue('custentity_sickleaho', sickLeaveDays);
    
        employeeRecord.save();
    
        log.debug('Updated Employee Record', {
            employeeId: employeeId,
            vacationDays: vacationDays,
            vacationHours: vacationHours,
            vacationMinutes: vacationMinutes,
            sickLeaveDays: sickLeaveDays
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce
    };
});
