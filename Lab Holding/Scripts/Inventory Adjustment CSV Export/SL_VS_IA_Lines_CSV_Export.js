/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || IA Lines CSV Export
 */
define(['N/record', 'N/file'], function (record, file) {

    function onRequest(context) {

        try {

            var iaId = context.request.parameters.iaid;

            log.debug('IA ID', iaId);

            if (!iaId) {
                context.response.write('Missing IA ID');
                return;
            }

            var ia = record.load({
                type: record.Type.INVENTORY_ADJUSTMENT,
                id: iaId
            });

            var location = ia.getText({
                fieldId: 'adjlocation'
            }) || '';

            var memo = ia.getValue({
                fieldId: 'memo'
            }) || '';

            var fileName = sanitize(location) + ' - ' + sanitize(memo) + '.csv';

            var csv = [];

            csv.push([
                'Line',
                'Item',
                'Quantity On Hand',
                'Adjust Qty By',
                'New Quantity',
                'Unit',
                'Unit Cost',
                'Total Value'
            ].join(','));

            var count = ia.getLineCount({
                sublistId: 'inventory'
            });

            log.debug('Line Count', count);

            for (var i = 0; i < count; i++) {

                var lineId = ia.getSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'line',
                    line: i
                });

                var item = ia.getSublistText({
                    sublistId: 'inventory',
                    fieldId: 'item',
                    line: i
                });

                var qtyOnHand = ia.getSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'quantityonhand',
                    line: i
                }) || 0;

                var adjustQty = ia.getSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'adjustqtyby',
                    line: i
                }) || 0;

                var newQty = ia.getSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'newquantity',
                    line: i
                }) || 0;

                var unit = ia.getSublistText({
                    sublistId: 'inventory',
                    fieldId: 'units',
                    line: i
                }) || '';

                var unitCost = ia.getSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'unitcost',
                    line: i
                }) || 0;

                var total = Number(newQty) * Number(unitCost);

                csv.push([
                    escapeCsv(lineId),
                    escapeCsv(item),
                    escapeCsv(qtyOnHand),
                    escapeCsv(adjustQty),
                    escapeCsv(newQty),
                    escapeCsv(unit),
                    escapeCsv(unitCost),
                    escapeCsv(total.toFixed(2))
                ].join(','));
            }

            var csvFile = file.create({
                name: fileName,
                fileType: file.Type.CSV,
                contents: csv.join('\n')
            });

            context.response.writeFile({
                file: csvFile,
                isInline: false
            });

        } catch (e) {

            log.error('onRequest Error', e);

            context.response.write(e.message);

        }

    }

    function escapeCsv(value) {

        value = value || '';

        value = String(value);

        if (value.indexOf(',') != -1 ||
            value.indexOf('"') != -1 ||
            value.indexOf('\n') != -1) {

            value = '"' + value.replace(/"/g, '""') + '"';
        }

        return value;

    }

    function sanitize(value) {

        value = value || '';

        return value.replace(/[\\/:*?"<>|]/g, '').trim();

    }

    return {
        onRequest: onRequest
    };

});