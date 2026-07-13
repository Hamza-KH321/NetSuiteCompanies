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
        FIELD_SESSION_ACTIVE: 'custrecord_vs_session_active',

        PROD_ORDER_RECORD: 'customrecord_vs_prod_production_order',
        FIELD_PRODORD_RECIPE: 'custrecord_vs_prod_production_recipe',
        FIELD_PRODORD_QTY: 'custrecord_vs_prod_production_qty',
        FIELD_PRODORD_NOTES: 'custrecord_vs_prod_prodord_processinginf',

        PROD_ORDER_ITEM_RECORD: 'customrecord_vs_prod_prodorder_items',
        FIELD_PRODORD_ITEM_PARENT: 'custrecord_vs_prod_productionorder',
        FIELD_PRODORD_ITEM_ITEM: 'custrecord_vs_prod_prodorder_item',
        FIELD_PRODORD_ITEM_UNITS: 'custrecord_vs_production_prod_units',
        FIELD_PRODORD_ITEM_QTY_RECIPE: 'custrecord_vs_prod_prodord_item_qtyrecip',
        FIELD_PRODORD_ITEM_QTY: 'custrecord_vs_prod_prodord_item_qty'
    };
});
