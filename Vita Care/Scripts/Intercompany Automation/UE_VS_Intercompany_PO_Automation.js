/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @fileName UE || Intercompany PO Automation
 */

define(['N/record', 'N/log'], function (record, log) {

    var CONFIG = {
        5: {
            icpo: {
                customForm: 228,
                subsidiary: 1, // Vita Care
                vendor: 520124, // V-581 Intercompany - Smart Basket
                approvalStatus: 2 // Approved
            },
            locations: {
                17: { icpoLocation: 2 } // Jeddah
            }
        }
    };

    var FIELDS = {
        irICPO: 'custbody_vs_intercompany_purchase_orde',
        icpoIR: 'custbody_vs_intercompany_ir'
    };

    function afterSubmit(context) {

        var irRecord = context.newRecord;
        var irId = irRecord.id;

        try {

            // Only proceed for Smart Basket subsidiary (id 5); otherwise stop the script
            var irSubsidiaryCheck = irRecord.getValue({ fieldId: 'subsidiary' });
            if (irSubsidiaryCheck != 5) {
                log.debug({ title: 'ICPO | Skipped', details: 'Subsidiary ' + irSubsidiaryCheck + ' is not Smart Basket (5). IR: ' + irId });
                return;
            }

            // Skip if IR is already linked to an ICPO
            var existingICPO = irRecord.getValue({ fieldId: FIELDS.irICPO });

            // if (existingICPO) {
            //     log.audit({ title: 'ICPO | Skipped', details: 'IR ' + irId + ' already linked. ICPO: ' + existingICPO });
            //     return;
            // }

            var irSubsidiary = irRecord.getValue({ fieldId: 'subsidiary' });
            var cfg = CONFIG[irSubsidiary];

            if (!cfg) {
                log.debug({ title: 'ICPO | No Config', details: 'No mapping for subsidiary ' + irSubsidiary + '. IR: ' + irId });
                return;
            }

            var irLocation = irRecord.getValue({ fieldId: 'location' });
            var locationCfg = cfg.locations[irLocation];

            if (!locationCfg) {
                log.audit({ title: 'ICPO | No Location Config', details: 'No location mapping for location ' + irLocation + ', subsidiary ' + irSubsidiary + '. IR: ' + irId });
                return;
            }

            var today = new Date();

            // 1. Create ICPO
            var icpoId = createICPO(irRecord, cfg, locationCfg, today);
            log.audit({ title: 'ICPO | Created', details: 'ICPO: ' + icpoId + ' | IR: ' + irId });

            // 2. Stamp IR with ICPO id
            var irValues = {};
            irValues[FIELDS.irICPO] = icpoId;

            record.submitFields({
                type: record.Type.ITEM_RECEIPT,
                id: irId,
                values: irValues,
                options: { enableSourcing: false, ignoreMandatoryFields: true }
            });
            log.audit({ title: 'ICPO | IR Updated', details: 'IR ' + irId + ' stamped with ICPO ' + icpoId });

        } catch (e) {
            log.error({ title: 'ICPO | afterSubmit Error', details: 'IR ' + irId + ' | ' + e.name + ': ' + e.message });
        }
    }

    function createICPO(irRecord, cfg, locationCfg, today) {
        try {
            var icpo = record.create({ type: record.Type.PURCHASE_ORDER, isDynamic: false });

            icpo.setValue({ fieldId: 'customform', value: cfg.icpo.customForm });
            icpo.setValue({ fieldId: 'subsidiary', value: cfg.icpo.subsidiary });
            icpo.setValue({ fieldId: 'entity', value: cfg.icpo.vendor });
            icpo.setValue({ fieldId: 'location', value: locationCfg.icpoLocation });
            icpo.setValue({ fieldId: 'trandate', value: today });
            icpo.setValue({ fieldId: 'approvalstatus', value: cfg.icpo.approvalStatus });
            icpo.setValue({ fieldId: FIELDS.icpoIR,    value: irRecord.id });

            copyItemLines(irRecord, icpo);

            var icpoId = icpo.save({ enableSourcing: false, ignoreMandatoryFields: true });
            return icpoId;

        } catch (e) {
            log.error({ title: 'ICPO | createICPO Error', details: e.name + ': ' + e.message });
            throw e;
        }
    }

    function copyItemLines(sourceRecord, targetRecord) {
        try {
            var lineCount = sourceRecord.getLineCount({ sublistId: 'item' });
            log.debug({ title: 'ICPO | copyItemLines', details: 'Copying ' + lineCount + ' line(s)' });

            for (var i = 0; i < lineCount; i++) {
                var item = sourceRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                var quantity = sourceRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });
                var rate = sourceRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i });
                var description = sourceRecord.getSublistValue({ sublistId: 'item', fieldId: 'description', line: i });

                targetRecord.setSublistValue({ sublistId: 'item', fieldId: 'item', line: i, value: item });
                targetRecord.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i, value: quantity });

                if (rate) targetRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: i, value: rate });
                if (description) targetRecord.setSublistValue({ sublistId: 'item', fieldId: 'description', line: i, value: description });
            }

        } catch (e) {
            log.error({ title: 'ICPO | copyItemLines Error', details: 'Line ' + i + ' | ' + e.name + ': ' + e.message });
            throw e;
        }
    }

    return { afterSubmit: afterSubmit };
});