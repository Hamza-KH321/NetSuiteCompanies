/**
 * @NApiVersion 2.1
 * @Filename VSP_Constants.js
 */

define([], function () {
    return {
        USER_RECORD: 'customrecord_vs_production_users',
        FIELD_USER_EMPLOYEE: 'custrecord_vs_employee_prod',
        FIELD_USER_PASSWORD: 'custrecord_vs_password_prod',
        FIELD_USER_LOCATION: 'custrecord_vs_location_prod',
        FIELD_USER_SUBSIDIARY: 'custrecord_vs_subsidiary_prod',

        SESSION_RECORD: 'customrecord_vs_production_external_sess',
        FIELD_SESSION_USER: 'custrecord_vs_user',
        FIELD_SESSION_TOKEN: 'custrecord_vs_session_token',
        FIELD_SESSION_IP: 'custrecord_vs_session_ip',
        FIELD_SESSION_START: 'custrecord_vs_session_start',
        FIELD_SESSION_END: 'custrecord_vs_session_end',
        FIELD_SESSION_ACTIVE: 'custrecord_vs_session_active'
    };
});
