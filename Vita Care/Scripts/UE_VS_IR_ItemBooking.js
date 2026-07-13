/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

define(['N/record', 'N/log', 'N/search'], function (record, log, search) {

    function afterSubmit(context) {
        try {
            if (context.type !== context.UserEventType.CREATE) {
                log.debug('Exit', 'Not CREATE mode');
                return;
            }

            const newRec = context.newRecord;
            const recId = newRec.id;

            // ============================
            // 1. Check createdfrom text
            // ============================
            const createdFromText = newRec.getText('createdfrom') || '';

            log.debug('Created From Text', createdFromText);

            if (!createdFromText.startsWith('Purchase')) {
                log.debug('Exit', 'Created From does not start with "Purchase"');
                return;
            }

            // ============================
            // 2. Load Item Receipt dynamic record
            // ============================
            const ir = record.load({ type: record.Type.ITEM_RECEIPT, id: recId, isDynamic: false });

            const location = ir.getValue('location');
            const itemReceiptID = ir.getValue('id');
            const lineCount = ir.getLineCount({ sublistId: 'item' });

            // ============================
            // 3. Create new Booking Record
            // ============================
            const booking = record.create({ type: 'customsale_vs_item_booking', isDynamic: true });

            // Header fields
            // booking.setValue({ fieldId: 'subsidiary', value: 1 });
            booking.setValue({ fieldId: 'entity', value: 33 });
            booking.setValue({ fieldId: 'transtatus', value: 'B' });
            booking.setValue({ fieldId: 'custbody_vs_initiate_booking', value: true });
            booking.setValue({ fieldId: 'custbody_vs_booking_reason', value: 1 });
            booking.setValue({ fieldId: 'custbody_vs_booking_creator', value: 373455 });
            booking.setValue({ fieldId: 'location', value: location });
            booking.setValue({ fieldId: 'custbody_vs_item_receipt_reference', value: itemReceiptID });

            // ============================
            // 4. Copy Lines (item, qty, inventorydetail)
            // ============================
            for (let i = 0; i < lineCount; i++) {

                const item = ir.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                const qty = ir.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });

                if (!item || qty <= 0) continue;

                booking.selectNewLine({ sublistId: 'item' });
                booking.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: item });
                booking.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: qty });

                // Copy inventory detail subrecord
                const hasInvDetail = ir.getSublistValue({ sublistId: 'item', fieldId: 'inventorydetailavail', line: i });

                if (hasInvDetail) {
                    const irInvDetail = ir.getSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line: i });
                    const invDetail = booking.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });

                    const invCount = irInvDetail.getLineCount({ sublistId: 'inventoryassignment' });

                    for (let x = 0; x < invCount; x++) {
                        const lot = irInvDetail.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'receiptinventorynumber', line: x });
                        const status = irInvDetail.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'inventorystatus', line: x });
                        const quantity = irInvDetail.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', line: x });

                        log.debug('Lot Details for Line ' + x, {
                            lot: lot,
                            status: status,
                            quantity: quantity
                        });

                        invDetail.selectNewLine({ sublistId: 'inventoryassignment' });

                        invDetail.setCurrentSublistText({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', text: lot });
                        invDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'inventorystatus', value: status });
                        invDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: quantity });

                        invDetail.commitLine({ sublistId: 'inventoryassignment' });
                    }
                }

                booking.commitLine({ sublistId: 'item' });
            }

            // ============================
            // 5. Save booking record
            // ============================
            const bookingId = booking.save({ ignoreMandatoryFields: true });
            log.audit('Booking Record Created', bookingId);

            // ============================
            // 6. Update Item Receipt with booking reference
            // ============================
            const irDynamic = record.load({ type: record.Type.ITEM_RECEIPT, id: recId, isDynamic: true });

            irDynamic.setValue({ fieldId: 'custbody_vs_ir_booking_reference', value: bookingId });

            irDynamic.save({ ignoreMandatoryFields: true });

            log.audit('Item Receipt Updated', 'Booking ID set: ' + bookingId);

        } catch (e) {
            log.error('Error in afterSubmit', e);
        }
    }

    return { afterSubmit: afterSubmit };
});
