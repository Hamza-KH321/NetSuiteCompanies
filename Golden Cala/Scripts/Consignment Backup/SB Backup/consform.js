/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/currentRecord', 'N/record', 'N/ui/serverWidget', 'N/file', 'N/format', 'N/task', 'N/redirect'],
    /**
 * @param{currentRecord} currentRecord
 * @param{record} record
 */
    (currentRecord, record, serverWidget, file, format, task, redirect) => {

        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var upload_file_field;
            var selectField;
            if (scriptContext.request.method === 'GET') {
                var form = serverWidget.createForm({ title: 'Upload Report' });
                upload_file_field = form.addField({ id: 'cust_page_file', type: serverWidget.FieldType.FILE, label: 'choose a file' });
                selectField = form.addField({ id: 'custpage_select', type: serverWidget.FieldType.SELECT, label: 'Select', source: 'customlist_customer_list_sheet' });
                upload_file_field.isMandatory = true;
                form.addSubmitButton({ label: 'Submit' });
                scriptContext.response.writePage(form);
            }
            else if (scriptContext.request.method === 'POST') {
                var customer_id = scriptContext.request.parameters.custpage_select;
                var fileObj = scriptContext.request.files.cust_page_file;
                //var fileRecord = file.create({ name: fileObj.name, fileType: fileObj.fileType, content: fileObj.getContents(), folder: 1926 });
                fileObj.folder = 1926;
                var id = fileObj.save();

                var mapReduceTask = task.create({ taskType: task.TaskType.MAP_REDUCE });
                mapReduceTask.scriptId = 'customscript_vs_cons';
                mapReduceTask.deploymentId = 'customdeploy_vs_cons_dep';

                log.debug('my id', id);
                mapReduceTask.params = {
                    'custscript_vs_cons_file_id': id+'/'+customer_id
                };
                log.debug('mapReduceTask', mapReduceTask);

                var taskId = mapReduceTask.submit();
            }
        }

        return { onRequest }

    });