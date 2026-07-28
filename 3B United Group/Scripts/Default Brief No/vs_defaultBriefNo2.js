/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
define(['N/record'], function(record) {


    function afterSubmit(context) {
        var brif = record.load({
            type: context.newRecord.type,
            id: context.newRecord.id,
            isDynamic: true
        });
        log.debug({ title: "brif", details: brif });

        var LeadNo = brif.getValue({
           fieldId: "entityid"
        });

        log.debug({ title: "leadno", details: LeadNo });

        brif.setValue({fieldId: 'vatregnumber', value: 0});
        brif.setValue({fieldId: 'custentity_vs_briefnumber', value: LeadNo});
        brif.save();

    }

    return {
        afterSubmit: afterSubmit
    }
});
