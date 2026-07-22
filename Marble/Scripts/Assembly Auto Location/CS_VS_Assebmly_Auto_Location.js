/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Assembly Auto Location
 */
define(['N/currentRecord', 'N/log'], function (currentRecord, log) {

    function pageInit(context) {
        try {
            log.debug('pageInit', 'Script Started');

            var rec = currentRecord.get();

            log.debug('pageInit', 'Setting Subsidiary to 2');

            rec.setValue({
                fieldId: 'subsidiary',
                value: 2,
                ignoreFieldChange: false
            });

            log.debug('pageInit', 'Waiting before setting Location');

            setTimeout(function () {
                try {
                    log.debug('setTimeout', 'Setting Location to 58');

                    rec.setValue({
                        fieldId: 'location',
                        value: 58,
                        ignoreFieldChange: false
                    });

                    log.debug('setTimeout', 'Location Set Successfully');

                } catch (innerError) {
                    log.error('setTimeout Error', innerError);
                }
            }, 2000); // 2 seconds delay

        } catch (e) {
            log.error('pageInit Error', e);
        }
    }

    return {
        pageInit: pageInit
    };
});