/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/currentRecord', 'N/record', 'N/ui/serverWidget', 'N/file', 'N/format', 'N/task', 'N/redirect', 'N/runtime', 'N/search'],
    /**
     * @param{currentRecord} currentRecord
     * @param{record} record
     */
    (currentRecord, record, serverWidget, file, format, task, redirect, runtime, search) => {

        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            try {
                var upload_file_field;
                var customerID;
                var taskId = scriptContext.request.parameters.custparam_taskid;
        
                if (scriptContext.request.method === 'GET') {
                    var form = serverWidget.createForm({ title: 'Upload Report' });
                    upload_file_field = form.addField({ id: 'cust_page_file', type: serverWidget.FieldType.FILE, label: 'Choose a file' });
                    upload_file_field.isMandatory = true;
        
                    // Create a select field without source, and add options dynamically
                    customerID = form.addField({id: 'custpage_select',type: serverWidget.FieldType.SELECT,label: 'Customer'});
                    
                    // Add a blank option as the default
                    customerID.addSelectOption({value: '',text: ''});
                    
                    // Define the customer search
                    var customerSearchObj = search.create({
                        type: "customer",
                        filters: [
                            ["cseg1", "anyof", "2"], 
                            "AND", 
                            ["entityid", "isnot", "NA"]
                        ],
                        columns: [
                            search.createColumn({ name: "entityid", label: "ID" }),
                            search.createColumn({ name: "companyname", label: "Name" }),
                            search.createColumn({ name: "internalid", label: "Internal ID" })
                        ]
                    });
                    
                    // Run the search and iterate through the results
                    customerSearchObj.run().each(function(result) {
                        var internalId = result.getValue({ name: 'internalid' });
                        var customerName = result.getValue({ name: 'companyname' });
                    
                        // Add each result as an option to the select field
                        customerID.addSelectOption({value: internalId,text: customerName});
                    
                        // Continue iteration
                        return true;
                    });
        
                    form.addSubmitButton({ label: 'Submit' });
        
                    if (taskId) {
                        var status = task.checkStatus(taskId);
        
                        if (status.status != task.TaskStatus.COMPLETE) {
                            form.addField({
                                id: 'custpage_status',
                                type: serverWidget.FieldType.INLINEHTML,
                                label: 'Status',
                                container: 'custpage_task_status'
                            }).defaultValue = '<div style="text-align:left">' +
                                '<div style="color:red"><h2>Processing. Please wait...</h2></div>' +
                                '<div>Percentage Completed: ' + status.getPercentageCompleted() + '%</div>' +
                                '<div>Current Stage: ' + status.stage + '</div>' +
                                '</div>';
                        } else if (status.status == task.TaskStatus.COMPLETE) {
                            form.addField({
                                id: 'custpage_status',
                                type: serverWidget.FieldType.INLINEHTML,
                                label: 'Status',
                                container: 'custpage_task_status'
                            }).defaultValue = '<h2 style="color:green;align:center">Task completed</h2>';
                        }
                    }
        
                    scriptContext.response.writePage(form);
                } else if (scriptContext.request.method === 'POST') {
                    var customer_id = scriptContext.request.parameters.custpage_select;
                    var fileObj = scriptContext.request.files.cust_page_file;
                
                    // Set the folder ID for the .txt file (folder 2042 as requested)
                    const folderId = 2042;
                
                    // Ensure file object is not null or undefined
                    if (!fileObj) {
                        throw new Error('File object is missing. Please upload a file.');
                    }
                
                    // Save the uploaded CSV file to its respective folder
                    const csvFolderId = 1926; // Replace with the folder ID for CSV storage
                    fileObj.folder = csvFolderId; // Save the uploaded CSV file
                    var csvFileId = fileObj.save(); // Get the CSV file's ID after saving
                    var csvFileName = fileObj.name; // Get the original name of the CSV file

                    log.debug('CSV File Saved', `CSV File ID: ${csvFileId}, Name: ${csvFileName}`);
                
                    // Create the .txt file (logging purposes) — NOT passing it to Map/Reduce
                    var originalFileName = fileObj.name.split('.')[0]; // Strip the extension for appending the datetime
                    var today = new Date();
                    var formattedDateTime = format.format({
                        value: today,
                        type: format.Type.DATETIME
                    }).replace(/[:\/]/g, '-'); // Replace characters not allowed in filenames (colons and slashes)
                
                    var newFileName = `${originalFileName}_${formattedDateTime}.txt`; // New .txt file name
                
                    // Create the new .txt file content (modify content as needed)
                    var fileContent = "This is the content of the .txt file based on the uploaded CSV.";
                
                    // Create the new .txt file
                    var newTextFile = file.create({
                        name: newFileName,
                        fileType: file.Type.PLAINTEXT, // .txt file type
                        contents: fileContent,
                        folder: folderId
                    });
                
                    // Save the .txt file in folder 2042
                    var newTextFileId = newTextFile.save();
                
                    log.debug('New Text File Created', `File ID: ${newTextFileId}, File Name: ${newFileName}`);
                
                    // Submit the Map/Reduce task using the CSV file's ID and name
                    if (csvFileId && customer_id) {
                        var mapReduceTask = task.create({ taskType: task.TaskType.MAP_REDUCE });
                        mapReduceTask.scriptId = 'customscript_vs_cons';
                        mapReduceTask.deploymentId = 'customdeploy_vs_cons_dep';
                        mapReduceTask.logFileID = newTextFileId;
                
                        // Pass the CSV file ID, file name, and customer ID to the Map/Reduce script
                        mapReduceTask.params = {
                            'custscript_vs_cons_file_id': csvFileId, // Pass the CSV file's ID
                            'custscript_vs_cons_file_name': csvFileName, // Pass the CSV file's name
                            'custscript_vs_customer_id': customer_id,
                            'custscript_vs_log_file_id': newTextFileId
                        };
                
                        try {
                            var taskId = mapReduceTask.submit();
                            log.debug('Map/Reduce Task Submitted', `Task ID: ${taskId}`);
                
                            // Redirect to check status
                            var params = { custparam_taskid: taskId };
                            redirect.toSuitelet({
                                scriptId: runtime.getCurrentScript().id,
                                deploymentId: runtime.getCurrentScript().deploymentId,
                                parameters: params
                            });
                        } catch (error) {
                            log.error('Error Submitting Map/Reduce Task', error);
                        }
                    } else {
                        log.error('Missing Required Data', 'Either the CSV file ID or customer ID is missing.');
                    }
                }               
                
            } catch (error) {
                log.error('ERROR!! ', error);
            }
        }

        return { onRequest }

    });
