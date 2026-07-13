/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/file', 'N/render', 'N/https', 'N/log'],
    function (record, search, file, render, https, log) {

        const IB_SHIPMENT_FILE_PATH = 'SuiteScripts/VC XML Profiles/VC_XML_IF.xml';
        const WMS_URL = 'https://soa12cprod.tamergroup.com/soa-infra/resources/vitacare/InboundMessageDispatcher!1.0/RestService/incomingPayload';

        function afterSubmit(context) {
            if (context.type === context.UserEventType.VIEW || context.type === context.UserEventType.DELETE) return;

            try {
                const fulfillment = record.load({ type: record.Type.ITEM_FULFILLMENT, id: context.newRecord.id });

                const createdFromId = fulfillment.getValue('createdfrom');
                const createdFromText = fulfillment.getText('createdfrom');

                if (!createdFromText || !createdFromText.startsWith('Transfer Order')) {
                    log.debug('INFO', 'Skipped — Not created from a Transfer Order.');
                    return;
                }

                let transferOrder;
                try {
                    transferOrder = record.load({ type: record.Type.TRANSFER_ORDER, id: createdFromId });
                } catch (e) {
                    log.error('ERROR', 'Unable to load Transfer Order: ' + e.message);
                    return;
                }

                const transferOrderLocation = transferOrder.getValue('location');
                if (transferOrderLocation != 9) {
                    log.debug('INFO', `Skipped — Transfer Order location is not VAN WH-Jeddah. Found: ${transferOrderLocation}`);
                    return;
                }

                const shipStatus = fulfillment.getValue('shipstatus');
                if (shipStatus !== 'C') {
                    log.debug('INFO', 'Item Fulfillment not yet shipped.');
                    fulfillment.setValue('custbody_vs_xml_error_details', 'Item Fulfillment not yet shipped.');
                    fulfillment.save();
                    return;
                }

                const jsonData = generateJSONProfile(fulfillment);
                const xmlProfile = generateXMLProfile(jsonData);

                log.debug('XML Payload', xmlProfile);

                const response = https.post({
                    url: WMS_URL,
                    body: xmlProfile,
                    headers: {
                        'Content-Type': 'text/plain',
                        'Accept': '*/*'
                    }
                });

                const { body, code } = response;
                log.debug('Response', `Code: ${code}, Body: ${body}`);

                if (code !== 200) {
                    fulfillment.setValue('custbody_vs_xml_error_interfacing', true);
                    fulfillment.setValue('custbody_vs_xml_error_details', `Error in sending data: ${body}`);
                } else {
                    fulfillment.setValue('custbody_vs_xml_posted', true);
                    fulfillment.setValue('custbody_vs_xml_error_interfacing', false);
                    fulfillment.setValue('custbody_vs_xml_error_details', 'Code 200 - Sent');
                }
                fulfillment.save();

            } catch (e) {
                log.error('ERROR', e);
                try {
                    const rec = record.load({ type: record.Type.ITEM_FULFILLMENT, id: context.newRecord.id });
                    rec.setValue('custbody_vs_xml_error_interfacing', true);
                    rec.setValue('custbody_vs_xml_error_details', `Internal Error: ${e.toString()}`);
                    rec.save();
                } catch (innerErr) {
                    log.error('SAVE ERROR', innerErr);
                }
            }
        }

        function generateJSONProfile(fulfillment) {
            const json = {
                hdr_group_nbr: fulfillment.id,
                shipment_nbr: fulfillment.getValue('tranid'),
                facility_code: '',
                company_code: 'VITACARE',
                trailer_nbr: '',
                shipment_type: 'IF',
                vendor_info: fulfillment.getText('entity'),
                shipped_date: fulfillment.getValue('trandate'),
                cust_field_1: fulfillment.id,
                cust_short_text_1: fulfillment.getText('custbody8'),
                itemdetails: []
            };

            const locationId = fulfillment.getValue('transferlocation');

            const facilityCode = search.lookupFields({
                type: search.Type.LOCATION,
                id: locationId,
                columns: ['custrecord_5826_loc_branch_id']
            });
            json.facility_code = facilityCode.custrecord_5826_loc_branch_id;

            const lineCount = fulfillment.getLineCount({ sublistId: 'item' });
            for (let i = 0; i < lineCount; i++) {
                const seqNumber = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: i });
                const itemId = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                const itemName = fulfillment.getSublistText({ sublistId: 'item', fieldId: 'item', line: i });
                const quantity = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });

                let subRecord;
                try {
                    subRecord = fulfillment.getSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line: i });
                } catch (e) {
                    subRecord = null;
                }

                if (subRecord) {
                    const subCount = subRecord.getLineCount({ sublistId: 'inventoryassignment' });
                    for (let j = 0; j < subCount; j++) {
                        const serial = subRecord.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', line: j });
                        const qty = subRecord.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', line: j });
                        const expiry = subRecord.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'expirationdate', line: j });
                        const status = subRecord.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'inventorystatus', line: j }) === 1 ? 'Good' : 'QA';

                        json.itemdetails.push({
                            seq_nbr: seqNumber,
                            item_part_a: itemName,
                            item_alternate_code: itemId,
                            batch_nbr: serial,
                            shipped_qty: qty,
                            putaway_type: '',
                            expiry_date: expiry,
                            cust_field_1: '',
                            lpn_lock_code: status,
                            uom: 'Piece'
                        });
                    }
                } else {
                    json.itemdetails.push({
                        seq_nbr: seqNumber,
                        item_part_a: itemName,
                        item_alternate_code: itemId,
                        batch_nbr: '',
                        shipped_qty: quantity,
                        putaway_type: '',
                        expiry_date: '',
                        cust_field_1: '',
                        lpn_lock_code: '',
                        uom: 'Piece'
                    });
                }
            }
            return json;
        }

        function generateXMLProfile(data) {
            const templateFile = file.load({ id: IB_SHIPMENT_FILE_PATH });
            const xmlRenderer = render.create();
            xmlRenderer.templateContent = templateFile.getContents();
            xmlRenderer.addCustomDataSource({
                format: render.DataSource.OBJECT,
                alias: 'responseJSON',
                data: data
            });

            const xmlContent = xmlRenderer.renderAsString();
            const savedFile = file.create({
                name: `ItemFulfillment_${new Date().getTime()}.xml`,
                fileType: file.Type.XMLDOC,
                contents: xmlContent,
                folder: 1535415 // IF XML Files
            });
            savedFile.save();
            return xmlContent;
        }

        return { afterSubmit };
    });
