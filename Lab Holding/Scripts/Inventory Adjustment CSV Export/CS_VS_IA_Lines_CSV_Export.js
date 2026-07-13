/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || IA Lines CSV Export
 */
define(['N/currentRecord'], function (currentRecord) {

    var CONFIG = {
        DATA_FIELD_ID: 'custpage_ia_csv_data',
        CSV_HEADERS: [
            'Line',
            'Item',
            'Quantity On Hand',
            'Adjust Qty By',
            'New Quantity',
            'Unit',
            'Unit Cost',
            'Total Value'
        ]
    };

    function pageInit(context) {
        try {
            console.log('IA Lines CSV Export client script loaded');
        } catch (e) {
            console.error('pageInit Error', e);
        }
    }

    function sanitizeFileNamePart(value) {
        try {
            if (!value) {
                return '';
            }
            return value.replace(/[\\/:*?"<>|]/g, '').trim();
        } catch (e) {
            console.error('sanitizeFileNamePart Error', e);
            return '';
        }
    }

    function escapeCsvValue(value) {
        try {
            var strValue = value === null || value === undefined ? '' : String(value);
            if (strValue.indexOf(',') !== -1 || strValue.indexOf('"') !== -1 || strValue.indexOf('\n') !== -1) {
                strValue = '"' + strValue.replace(/"/g, '""') + '"';
            }
            return strValue;
        } catch (e) {
            console.error('escapeCsvValue Error', e);
            return '';
        }
    }

    function downloadInventoryAdjustmentCSV() {
        try {
            var rec = currentRecord.get();

            var rawData = rec.getValue({ fieldId: CONFIG.DATA_FIELD_ID });
            if (!rawData) {
                alert('No data available to export.');
                return;
            }

            var payload = JSON.parse(rawData);
            var lines = payload.lines || [];

            var locationPart = sanitizeFileNamePart(payload.location);
            var memoPart = sanitizeFileNamePart(payload.memo);
            var fileName = locationPart + ' - ' + memoPart + '.csv';

            var csvRows = [];
            csvRows.push(CONFIG.CSV_HEADERS.join(','));

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var totalValue = line.newquantity * line.unitcost;

                var row = [
                    escapeCsvValue(line.lineid),
                    escapeCsvValue(line.item),
                    escapeCsvValue(line.quantityonhand),
                    escapeCsvValue(line.adjustqtyby),
                    escapeCsvValue(line.newquantity),
                    escapeCsvValue(line.unit),
                    escapeCsvValue(line.unitcost),
                    escapeCsvValue(totalValue.toFixed(2))
                ];

                csvRows.push(row.join(','));
            }

            var csvContent = csvRows.join('\n');

            var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            var url = window.URL.createObjectURL(blob);

            var link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (e) {
            console.error('downloadInventoryAdjustmentCSV Error', e);
            alert('Error exporting CSV: ' + e.message);
        }
    }

    return {
        pageInit: pageInit,
        downloadInventoryAdjustmentCSV: downloadInventoryAdjustmentCSV
    };
});