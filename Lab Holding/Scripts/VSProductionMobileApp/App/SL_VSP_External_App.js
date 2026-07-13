/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @Filename SL_VSP_External_App.js
 */

define(['./Services/VSP_App_Service.js'], function (appService) {
    return {
        onRequest: appService.onRequest
    };
});
