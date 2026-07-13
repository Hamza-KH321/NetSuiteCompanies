/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/file', 'N/record', 'N/log', 'N/runtime', 'N/format', 'N/search'],
    function(file, record, log, runtime, format, search) {
        
        function getInputData(context) {
            // Retrieve the file ID from the script parameter
            var fileId = runtime.getCurrentScript().getParameter('custscript_file_id');
            log.debug('File ID Received', fileId);

            // Load the file using the file ID
            var fileObj = file.load({
                id: fileId
            });

            // Read the contents of the file as a string
            var fileContents = fileObj.getContents();
            
            // Split the file contents into lines (assuming the file is in CSV format for easier processing)
            var lines = fileContents.split('\n');

            // Convert each line into an object containing the necessary fields
            var data = lines.map(function(line) {
                var columns = line.split(',');

                // Ensure there are enough columns to avoid undefined errors
                if (columns.length < 10) {
                    return null; // Skip lines that do not have the required number of columns
                }

                return {
                    name: columns[0] ? columns[0].trim() : '',  // Check for undefined and trim
                    date: columns[1] ? columns[1].trim() : '',
                    onDuty: columns[2] ? columns[2].trim() : '',
                    offDuty: columns[3] ? columns[3].trim() : '',
                    clockIn: columns[4] ? columns[4].trim() : '',
                    clockOut: columns[5] ? columns[5].trim() : '',
                    late: columns[6] ? columns[6].trim() : '',
                    early: columns[7] ? columns[7].trim() : '',
                    absent: columns[8] ? columns[8].trim() : '',
                    workTime: columns[9] ? columns[9].trim() : ''
                };
            }).filter(function(line) {
                return line !== null;  // Remove any null lines
            });

            return data; // Return the data to be processed in the Map stage
        }

        function map(context) {
            // Parse the input data
            var attendanceData = JSON.parse(context.value);

            // Search for the employee ID based on the employee name
            var employeeId = getEmployeeIdByName(attendanceData.name);
            if (!employeeId) {
                log.error('Employee Not Found', 'Employee name: ' + attendanceData.name);
                return; // Skip creating a record if the employee is not found
            }

            // Create a new custom record for attendance
            var attendanceRecord = record.create({type: 'customrecord_vs_attendance',isDynamic: true});

            // Set the field values
            attendanceRecord.setValue({fieldId: 'custrecord_vs_employee',value: employeeId});
            attendanceRecord.setValue({fieldId: 'custrecord_vs_date_attendance',value: format.parse({ value: attendanceData.date, type: format.Type.DATE })});
            attendanceRecord.setValue({fieldId: 'custrecord_vs_onduty',value: parseTime(attendanceData.onDuty)});  
            attendanceRecord.setValue({fieldId: 'custrecord_vs_offduty',value: parseTime(attendanceData.offDuty)}); 
            attendanceRecord.setValue({fieldId: 'custrecord_vs_clockin',value: parseTime(attendanceData.clockIn)});
            attendanceRecord.setValue({fieldId: 'custrecord_vs_clockout',value: parseTime(attendanceData.clockOut)});
            attendanceRecord.setValue({fieldId: 'custrecord_vs_late', value: convertToMinutes(attendanceData.late)});
            attendanceRecord.setValue({fieldId: 'custrecord_vs_early', value: convertToMinutes(attendanceData.early)});            
            attendanceRecord.setValue({fieldId: 'custrecord_vs_absent',value: attendanceData.absent.trim() !== ''});
            attendanceRecord.setValue({fieldId: 'custrecord_vs_worktime',value: attendanceData.workTime});

            // Save the record
            var recordId = attendanceRecord.save();
            log.debug('Attendance Record Created', 'Record ID: ' + recordId);
        }

        function parseTime(timeStr) {
            // Convert a "HH:mm" time string to a Date object
            if (!timeStr) {
                return null;
            }

            var timeParts = timeStr.split(':');
            var dateObj = new Date();
            dateObj.setHours(parseInt(timeParts[0], 10));
            dateObj.setMinutes(parseInt(timeParts[1], 10));
            dateObj.setSeconds(0);
            dateObj.setMilliseconds(0);

            return dateObj;
        }

        function getEmployeeIdByName(employeeName) {
            // Search for the employee by name to get the internal ID
            var employeeSearch = search.create({
                type: search.Type.EMPLOYEE,
                filters: [['entityid', 'is', employeeName]],  // Filter by employee name (entityid)
                columns: ['internalid']  // Return the internal ID
            });

            var searchResult = employeeSearch.run().getRange({ start: 0, end: 1 });
            if (searchResult.length > 0) {
                return searchResult[0].getValue('internalid');  // Return the internal ID if found
            }
            return null;  // Return null if not found
        }

        function reduce(context) {
            // Not needed for this scenario, but defined for completeness
        }

        function summarize(summary) {
            log.audit('Map/Reduce Script Completed', {
                'Map Errors': summary.mapSummary.errors.iterator().each(function (key, error) {
                    log.error('Map Error: ' + key, error);
                    return true;
                })
            });
        }

        function convertToMinutes(timeStr) {
            // Check if the time string is empty or null
            if (!timeStr || timeStr.trim() === '') {
                return 0; // Return 0 if the cell is empty
            }
        
            // Split the string into hours and minutes
            var timeParts = timeStr.split(':');
            var hours = parseInt(timeParts[0], 10);
            var minutes = parseInt(timeParts[1], 10);
        
            // Calculate the total minutes
            var totalMinutes = (hours * 60) + minutes;
        
            return totalMinutes;
        }
        

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
    });
