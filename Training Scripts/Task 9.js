/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/record', 'N/log', 'N/error', 'N/ui/serverWidget'],
    function(record, log, error, serverWidget) {

        function onRequest(context) {
            if (context.request.method === 'GET') {
                var form = serverWidget.createForm({
                    title: 'Lead Quick Add'
                });

                var nameField = form.addField({
                    id: 'name',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Name'
                });
                var emailField = form.addField({
                    id: 'email',
                    type: serverWidget.FieldType.EMAIL,
                    label: 'Email'
                });

                form.addSubmitButton({
                    label: 'Submit'
                });

                context.response.writePage(form);

            } else if (context.request.method === 'POST') {
                var name = context.request.parameters.name;
                var email = context.request.parameters.email;

                try {
                    var leadRecord = record.create({
                        type: record.Type.LEAD,
                        isDynamic: true
                    });
                    leadRecord.setValue({
                        fieldId: 'entitystatus',
                        value: 6 
                    });
                    leadRecord.setValue({
                        fieldId: 'companyname',
                        value: name
                    });
                    leadRecord.setValue({
                        fieldId: 'email',
                        value: email
                    });

                    var leadId = leadRecord.save();

                    context.response.write('SUCCESS - Lead created successfully with ID: ' + leadId);

                } catch (e) {
                    log.error('Error', e.toString());
                    context.response.write('Error - ' + e.toString());
                }
            }
        }

        return {
            onRequest: onRequest
        };
    });
