/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS_ICSO_Automate_Button.js
 */

define(['N/currentRecord', 'N/url'], function (currentRecord, url) {

    console.log('IC SO Button | Client script module loaded');

    var CONFIG = {
        suiteletScriptId: 'customscript_vs_sl_icso_automate_receivi',
        suiteletDeploymentId: 'customdeploy_vs_sl_icso_automate_receivi'
    };

    function pageInit(context) {
        console.log('IC SO Button | pageInit fired');
    }

    function automateIntercompanySOReceiving() {

        console.log('IC SO Button | Button clicked, function entered');

        var soId = currentRecord.get().id;

        console.log('IC SO Button | soId: ' + soId);

        if (!soId) {
            alert('Please save the record first.');
            return;
        }

        var confirmed = confirm(
            'This will create the Item Fulfillment and Item Receipt for this ' +
            'intercompany sales order. Continue?'
        );

        console.log('IC SO Button | confirmed: ' + confirmed);

        if (!confirmed) {
            return;
        }

        var suiteletUrl = url.resolveScript({
            scriptId: CONFIG.suiteletScriptId,
            deploymentId: CONFIG.suiteletDeploymentId,
            params: { soid: soId }
        });

        console.log('IC SO Button | Resolved suiteletUrl: ' + suiteletUrl);

        window.location.href = suiteletUrl;
    }

    return {
        pageInit: pageInit,
        automateIntercompanySOReceiving: automateIntercompanySOReceiving
    };
});