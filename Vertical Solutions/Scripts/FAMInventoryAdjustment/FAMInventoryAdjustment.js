/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName FAM Inventory Adjustment
 */
define([
    'N/https',
    'N/runtime',
    'N/ui/message',
    'N/error',
    'N/log'
], function (https, runtime, message, error, log) {

    //--------------------------------------------------------------------------
    // Configuration
    //--------------------------------------------------------------------------

    var SERVICE_ID = '3';

    //--------------------------------------------------------------------------
    // Before Load
    //--------------------------------------------------------------------------

    function beforeLoad(context) {

        var UserEventType = context.UserEventType;

        if (context.type == UserEventType.PRINT) {
            return;
        }

        if (context.type == UserEventType.PDF) {
            return;
        }

        try {

            var companyCode = getCompanyCode().toLowerCase();

            var suiteletUrl =
                'https://59289.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=170&deploy=1&compid=59289&ns-at=AAEJ7tMQ4cjbLyCcBegmGCoMgSw8jVrmHhU2e0jPrMsIW6Qo8FA&service=' +
                SERVICE_ID +
                '&companycode=' +
                companyCode;

            log.debug('Suitelet URL', suiteletUrl);

            var response = https.get({
                url: suiteletUrl
            });

            log.debug('Response Body', response.body);

            var result = JSON.parse(response.body);

            log.debug('Result', result);

            if (!result.success || !result.subscribed) {

                var label = getStatusLabel(result);

                if (
                    context.type == UserEventType.CREATE ||
                    context.type == UserEventType.COPY
                ) {

                    throw error.create({
                        name: 'Unexpected Error',
                        message: label.title + '\n\n' + label.text,
                        notifyOff: true
                    });

                }

                lockForm(context.form, result);

            }

        } catch (e) {

            log.error('beforeLoad Error', e);

            if (e.name == 'Unexpected Error') {
                throw e;
            }

            lockForm(context.form, {
                status: 'ERROR',
                message: e.message
            });

        }

    }

    function getCompanyCode() {
        return runtime.accountId;
    }

    function getStatusLabel(result) {

        var labels = {

            NON_SUBSCRIBED: {
                title: 'Unexpected Error',
                text:
                    'Unexpected Error.' +
                    'Please contact your NetSuite implementation partner for assistance.'
            },

            EXPIRED: {
                title: 'Unexpected Error',
                text:
                    'Unexpected Error.' +
                    'Please contact your NetSuite implementation partner for assistance.'
            },

            ERROR: {
                title: 'Unexpected Error',
                text:
                    'Unexpected Error.' +
                    'Please contact your NetSuite implementation partner for assistance.'
            }

        };

        return labels[result.status] || labels.ERROR;

    }

    function lockForm(form, result) {

        try {

            var label = getStatusLabel(result);

            form.addPageInitMessage({
                type: message.Type.ERROR,
                title: label.title,
                message: label.text
            });

            var buttons = [
                'edit',
                'save',
                'delete',
                'editforecast',
                'approve',
                'reject',
                'void'
            ];

            for (var i = 0; i < buttons.length; i++) {

                try {

                    form.removeButton({
                        id: buttons[i]
                    });

                } catch (ex) {

                    log.debug('Unable to remove button', buttons[i]);

                }

            }

        } catch (e) {

            log.error('lockForm Error', e);

        }

    }

    return {
        beforeLoad: beforeLoad
    };

});