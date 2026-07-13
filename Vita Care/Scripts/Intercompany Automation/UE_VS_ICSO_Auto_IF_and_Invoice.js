/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @fileName UE || ICSO Automate Button
 *
 * Adds an "Automate Intercompany SO Receiving" button to the Sales Order form.
 * Button is shown only when:
 *   - entity = 520118
 *   - subsidiary = 5
 *   - intercotransaction is not empty
 *   - custbody_vs_ic_fulfilment_created is not checked
 *
 * IMPORTANT: update CLIENT_SCRIPT_PATH below to match wherever you upload
 * CS_ICSO_Automate_Button.js in the file cabinet.
 */

define(['N/ui/serverWidget', 'N/log'], function (serverWidget, log) {

    var CONFIG = {
        entity: 520118,
        subsidiary: 5,
        clientScriptPath: './CS_VS_ICSO_Automate_Button.js' // adjust path if needed
    };

    var FIELDS = {
        intercoTransaction: 'intercotransaction',
        fulfilmentCreated: 'custbody_vs_ic_fulfilment_created'
    };

    function beforeLoad(context) {

        log.debug({ title: 'IC SO Button | beforeLoad fired', details: 'type: ' + context.type });

        if (context.type !== context.UserEventType.VIEW &&
            context.type !== context.UserEventType.EDIT) {
            log.debug({ title: 'IC SO Button | Skipped', details: 'context.type not VIEW/EDIT: ' + context.type });
            return;
        }

        var soRecord = context.newRecord;

        var entity = soRecord.getValue({ fieldId: 'entity' });
        var subsidiary = soRecord.getValue({ fieldId: 'subsidiary' });
        var intercoTxn = soRecord.getValue({ fieldId: FIELDS.intercoTransaction });
        var alreadyFulfilled = soRecord.getValue({ fieldId: FIELDS.fulfilmentCreated });

        log.debug({
            title: 'IC SO Button | Field values',
            details: 'SO ' + soRecord.id + ' | entity: ' + entity + ' | subsidiary: ' + subsidiary +
                ' | intercoTxn: ' + intercoTxn + ' | alreadyFulfilled: ' + alreadyFulfilled
        });

        var showButton = (entity == CONFIG.entity) &&
            (subsidiary == CONFIG.subsidiary) &&
            !!intercoTxn &&
            !alreadyFulfilled;

        log.debug({ title: 'IC SO Button | showButton decision', details: 'SO ' + soRecord.id + ' | showButton: ' + showButton });

        if (!showButton) {
            return;
        }

        var form = context.form;

        form.clientScriptModulePath = CONFIG.clientScriptPath;

        form.addButton({
            id: 'custpage_automate_ic_receiving',
            label: 'Automate Intercompany SO Receiving',
            functionName: 'automateIntercompanySOReceiving'
        });

        log.debug({ title: 'IC SO Button | Button Added', details: 'SO ' + soRecord.id + ' | clientScriptPath: ' + CONFIG.clientScriptPath });
    }

    return { beforeLoad: beforeLoad };
});