/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Close RMA Lines
 */
define(['N/runtime', 'N/file', 'N/search', 'N/record', 'N/log'],
    function (runtime, file, search, record, log) {

        function getInputData() {
            try {

                log.debug('START', 'Close RMA Lines Map Reduce Started');

                var script = runtime.getCurrentScript();

                var fileId = script.getParameter({
                    name: 'custscript_vs_rma_csv_file_id'
                });

                if (!fileId) {
                    throw new Error('CSV File ID parameter is missing.');
                }

                var csvFile = file.load({
                    id: fileId
                });

                var fileContent = csvFile.getContents();

                var rows = fileContent.split(/\r?\n/);

                var inputData = [];

                /*
                 * Start from index 1 to skip the header:
                 * RMA #
                 */
                for (var i = 1; i < rows.length; i++) {

                    var rmaNumber = rows[i];

                    if (rmaNumber) {

                        rmaNumber = rmaNumber
                            .replace(/"/g, '')
                            .trim();

                        if (rmaNumber) {

                            inputData.push({
                                rmaNumber: rmaNumber
                            });

                            log.debug('RMA Added To Input', rmaNumber);
                        }
                    }
                }

                log.audit('Total RMAs Found', inputData.length);

                return inputData;

            } catch (e) {

                log.error('getInputData Error', {
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                });

                throw e;
            }
        }

        function map(context) {
            try {

                var data = JSON.parse(context.value);

                var rmaNumber = data.rmaNumber;

                log.debug('Processing RMA', rmaNumber);

                var rmaId = getRmaInternalId(rmaNumber);

                if (!rmaId) {

                    log.error('RMA Not Found', {
                        rmaNumber: rmaNumber
                    });

                    return;
                }

                log.debug('RMA Found', {
                    rmaNumber: rmaNumber,
                    internalId: rmaId
                });

                closeRmaLines(rmaId, rmaNumber);

            } catch (e) {

                log.error('Map Error', {
                    value: context.value,
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                });
            }
        }

        function getRmaInternalId(rmaNumber) {
            try {

                log.debug('Searching RMA', rmaNumber);

                var rmaSearch = search.create({
                    type: search.Type.RETURN_AUTHORIZATION,
                    filters: [
                        ['tranid', 'is', rmaNumber],
                        'AND',
                        ['mainline', 'is', 'T']
                    ],
                    columns: [
                        search.createColumn({
                            name: 'internalid'
                        })
                    ]
                });

                var searchResult = rmaSearch.run().getRange({
                    start: 0,
                    end: 1
                });

                if (searchResult && searchResult.length > 0) {

                    var internalId = searchResult[0].getValue({
                        name: 'internalid'
                    });

                    log.debug('RMA Internal ID Found', {
                        rmaNumber: rmaNumber,
                        internalId: internalId
                    });

                    return internalId;
                }

                return null;

            } catch (e) {

                log.error('getRmaInternalId Error', {
                    rmaNumber: rmaNumber,
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                });

                throw e;
            }
        }

        function closeRmaLines(rmaId, rmaNumber) {
            try {

                var rmaRecord = record.load({
                    type: record.Type.RETURN_AUTHORIZATION,
                    id: rmaId,
                    isDynamic: false
                });

                var lineCount = rmaRecord.getLineCount({
                    sublistId: 'item'
                });

                for (var i = 0; i < lineCount; i++) {

                    rmaRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'isclosed',
                        line: i,
                        value: true
                    });
                }

                var savedRmaId = rmaRecord.save({
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                });

                log.audit('RMA Successfully Updated', {
                    rmaNumber: rmaNumber,
                    internalId: savedRmaId,
                    linesClosed: lineCount
                });

            } catch (e) {

                log.error('closeRmaLines Error', {
                    rmaId: rmaId,
                    rmaNumber: rmaNumber,
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                });

                throw e;
            }
        }

        return {
            getInputData: getInputData,
            map: map
        };

    });