/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(['N/search', 'N/record'],

    function (search, record) {

        function getInputData() {
            // Load the saved search results
            try {

                // OLD PO Expiry Saved Search
                //    var purchaseorderSearchObj = search.create({
                //    type: "purchaseorder",
                //    settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
                //    filters:
                //    [
                //       ["mainline","is","T"], 
                //       "AND", 
                //       ["type","anyof","PurchOrd"], 
                //       "AND", 
                //       ["formuladate: {custbody_vs_poexpirydate}","on","19/05/2024","17/05/2024"]
                //    ],
                //    columns:
                //    [
                //       search.createColumn({name: "internalid", label: "Internal ID"}),
                //       search.createColumn({name: "tranid", label: "Document Number"}),
                //       search.createColumn({name: "trandate", label: "Date"}),
                //       search.createColumn({name: "custbody_vs_poexpirydate", label: "PO Expiry Date"})
                //    ]
                // });

                // Old Search 2 
                //    var purchaseorderSearchObj = search.create({
                //    type: "purchaseorder",
                //    settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
                //    filters:
                //    [
                //       ["mainline","is","T"], 
                //       "AND", 
                //       ["type","anyof","PurchOrd"], 
                //       "AND", 
                //       ["custbody_vs_poexpirydate","isnotempty",""], 
                //       "AND", 
                //       ["formuladate: {custbody_vs_poexpirydate}","on","today"]
                //    ],
                //    columns:
                //    [
                //       search.createColumn({name: "internalid", label: "Internal ID"}),
                //       search.createColumn({name: "trandate", label: "Date"}),
                //       search.createColumn({name: "custbody_vs_poexpirydate", label: "PO Expiry Date"}),
                //       search.createColumn({
                //          name: "formulanumeric",
                //          formula: " FLOOR( {today} - {trandate} )",
                //          label: "Formula (Numeric)"
                //       })
                //    ]
                // });

                // Updated search to get all previous PO's that have been opened for some reason while the order was closed.
                var purchaseorderSearchObj = search.create({
                    type: "purchaseorder",
                    settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                    filters:
                        [
                            ["mainline", "is", "T"],
                            "AND",
                            ["type", "anyof", "PurchOrd"],
                            "AND",
                            ["custbody_vs_poexpirydate", "isnotempty", ""],
                            "AND",
                            ["formuladate: {custbody_vs_poexpirydate}", "onorbefore", "today"],
                            "AND",
                            ["status", "noneof", "PurchOrd:H", "PurchOrd:G", "PurchOrd:C"],
                            "AND",
                            ["custbody_vs_potype", "noneof", "2"]

                        ],
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "Internal ID" }),
                            search.createColumn({ name: "trandate", label: "Date" }),
                            search.createColumn({ name: "custbody_vs_poexpirydate", label: "PO Expiry Date" }),
                            search.createColumn({
                                name: "formulanumeric",
                                formula: " FLOOR( {today} - {trandate} )",
                                label: "Date Difference"
                            }),
                            search.createColumn({ name: "statusref", label: "Status" })
                        ]
                });

            } catch (error) {
                log.error('ERRORRRR in Get Input Data Function', error);
            }

            return purchaseorderSearchObj;
        }

        function map(context) {
            try {
                var searchResult = JSON.parse(context.value);
                // log.debug('Search Result is' , searchResult);

                // Get the Purchase Order ID from the search result
                var poId = searchResult.id;
                // log.debug('PO ID is' , poId);
                // Load the Purchase Order record
                var poRecord = record.load({ type: record.Type.PURCHASE_ORDER, id: poId });

                // Loop through PO lines and lock each line
                var lineCount = poRecord.getLineCount({ sublistId: 'item' });
                // log.debug('Line Count' , lineCount);
                for (var i = 0; i < lineCount; i++) {
                    // log.debug('For Loop Entered.');
                    // Set the "Closed" checkbox to true
                    poRecord.setSublistValue({ sublistId: 'item', fieldId: 'isclosed', line: i, ignoreMandatoryFields: true, value: true });
                }

                // Save the modified Purchase Order record
                log.debug('Record is Saved Successfully!', poId);
                poRecord.save();
            } catch (error) {
                log.error('ERRORRR in Map Function', error);
            }
        }

        return {
            getInputData: getInputData,
            map: map,
        };

    });
