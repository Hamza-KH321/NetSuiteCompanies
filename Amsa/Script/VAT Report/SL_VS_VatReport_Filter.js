/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/redirect', 'N/search'], function(serverWidget, redirect, search) {

    function onRequest(context) {
        if (context.request.method === 'GET') {
            var form = serverWidget.createForm({
                title: 'Date Range Form'
            });

            // Create two date fields
            var startDateField = form.addField({
                id: 'custpage_start_date',
                type: serverWidget.FieldType.DATE,
                label: 'Start Date'
            });

            var endDateField = form.addField({
                id: 'custpage_end_date',
                type: serverWidget.FieldType.DATE,
                label: 'End Date'
            });

            // Create a list field for Language
            var languageField = form.addField({
                id: 'custpage_language',
                type: serverWidget.FieldType.SELECT,
                label: 'Language'
            });

            // Add options to the Language list
            languageField.addSelectOption({
                value: 'en',
                text: 'English'
            });
            languageField.addSelectOption({
                value: 'ar',
                text: 'Arabic'
            });

            // Create a list field for Subsidiary
            var subsidiaryField = form.addField({
                id: 'custpage_subsidiary',
                type: serverWidget.FieldType.SELECT,
                label: 'Subsidiary'
            });

            // Add subsidiaries dynamically
            subsidiaryField.addSelectOption({
                value: '',
                text: ''
            }); // Default empty option

            var subsidiarySearch = search.create({
                type: search.Type.SUBSIDIARY,
                columns: ['internalid', 'name']
            });

            subsidiarySearch.run().each(function(result) {
                subsidiaryField.addSelectOption({
                    value: result.getValue('internalid'),
                    text: result.getValue('name')
                });
                return true; // Continue iterating
            });

            // Create a submit button
            form.addSubmitButton({
                label: 'Submit'
            });

            context.response.writePage(form);
        } else {
            // Handle form submission
            var startDate = context.request.parameters.custpage_start_date;
            var endDate = context.request.parameters.custpage_end_date;
            var language = context.request.parameters.custpage_language;
            var subsidiary = context.request.parameters.custpage_subsidiary;

            // Define the base URLs for each language
            var englishScriptUrl = 'https://8038963.app.netsuite.com/app/site/hosting/scriptlet.nl?script=638&deploy=1';
            var arabicScriptUrl = 'https://8038963.app.netsuite.com/app/site/hosting/scriptlet.nl?script=637&deploy=1';

            // Choose the correct URL based on the selected language
            var targetUrl = (language === 'en') ? englishScriptUrl : arabicScriptUrl;

            // Log the submitted values
            log.debug('Start Date', startDate);
            log.debug('End Date', endDate);
            log.debug('Language', language);
            log.debug('Subsidiary', subsidiary);

            // Redirect to the selected script with additional parameters
            redirect.redirect({
                url: targetUrl +
                    '&custparam_start_date=' + encodeURIComponent(startDate) +
                    '&custparam_end_date=' + encodeURIComponent(endDate) +
                    '&custparam_subsidiary=' + encodeURIComponent(subsidiary),
                isExternal: true
            });
        }
    }

    return {
        onRequest: onRequest
    };
});
