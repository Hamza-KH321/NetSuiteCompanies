/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @Filename LIB_VSP_Subscription_Check.js
 */

define([], function () {
    function check() {
        return {
            allowed: true,
            result: { status: 'SUBSCRIBED' },
            label: getStatusLabel({ status: 'SUBSCRIBED' })
        };
    }

    function getStatusLabel(result) {
        var labels = {
            SUBSCRIBED: {
                title: 'Subscription Active',
                text: 'The service is available.'
            },
            ERROR: {
                title: 'Subscription Check Failed',
                text: 'The subscription validation service could not be reached.'
            }
        };

        return labels[result.status] || labels.ERROR;
    }

    return {
        check: check,
        getStatusLabel: getStatusLabel
    };
});
