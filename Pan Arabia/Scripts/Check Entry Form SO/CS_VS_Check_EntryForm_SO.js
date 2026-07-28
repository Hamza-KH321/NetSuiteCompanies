/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/log'], function (log) {
    var isBypass = false;

    function fieldChanged(context) {
        try {
            var currentFieldId = context.fieldId;
            var currentRecord = context.currentRecord;

            if (currentFieldId === 'customform') {
                if (isBypass) {
                    isBypass = false; 
                    return;
                }

                var formValue = currentRecord.getValue({ fieldId: 'customform' });
                log.debug('Custom Form Selected', formValue);

                var invalidForms = [68, 86, 88, 89];

                if (invalidForms.includes(parseInt(formValue))) {
                    alert('You are using a wrong form. Please choose another one that starts with (Pan).');

                    isBypass = true;

                    currentRecord.setValue({ fieldId: 'customform', value: '' });

                    setTimeout(function () {
                        var customFormInput = document.querySelector('[name="customform"]');
                        if (customFormInput) {
                            customFormInput.focus();
                        }
                    }, 100);

                    return false;
                }
            }

            if (currentFieldId === 'entity') {
                var formValue = currentRecord.getValue({ fieldId: 'customform' });
                log.debug('Entity Changed — Checking Form Again', formValue);

                var invalidForms = [68, 86, 88, 89];

                if (invalidForms.includes(parseInt(formValue))) {
                    alert('You are using a wrong form. Please choose another one that starts with (Pan).');

                    isBypass = true;

                    currentRecord.setValue({ fieldId: 'customform', value: '' });

                    setTimeout(function () {
                        var customFormInput = document.querySelector('[name="customform"]');
                        if (customFormInput) {
                            customFormInput.focus();
                        }
                    }, 100);
                }
            }

        } catch (error) {
            log.error('Error in fieldChanged', error);
        }
    }

    return {
        fieldChanged: fieldChanged
    };
});
