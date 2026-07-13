/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Available Qty for Gifts
 */
define(['N/search', 'N/currentRecord', 'N/ui/message', 'N/log'], function (search, currentRecord, message, log) {

    function fieldChanged(context) {
        try {

            var rec = context.currentRecord;

            if (context.sublistId == 'recmachcustrecord_vs_parent_new' && context.fieldId == 'custrecord_vs_item_new') {

                var selectedItem = rec.getCurrentSublistValue({
                    sublistId: 'recmachcustrecord_vs_parent_new',
                    fieldId: 'custrecord_vs_item_new'
                });

                var location = rec.getValue('custrecord_vs_location_new');

                log.debug('Selected Item', selectedItem);
                log.debug('Location', location);

                /**
                 * LOCATION VALIDATION
                 */
                if (!location) {
                    alert('Please choose a location first.');
                    return;
                }

                /**
                 * SEARCH AVAILABLE QTY
                 */
                var inventorybalanceSearchObj = search.create({
                    type: "inventorynumber",
                    filters: [
                        ["item", "anyof", selectedItem],
                        "AND",
                        ["location", "anyof", location]
                    ],
                    columns: [
                        search.createColumn({
                            name: "item",
                            summary: "GROUP"
                        }),
                        search.createColumn({
                            name: "location",
                            summary: "GROUP"
                        }),
                        search.createColumn({
                            name: "quantityavailable",
                            summary: "SUM"
                        })
                    ]
                });

                inventorybalanceSearchObj.run().each(function (result) {

                    var quantityAvailable = result.getValue({
                        name: "quantityavailable",
                        summary: "SUM"
                    });

                    log.debug('Quantity Available', quantityAvailable);

                    rec.setCurrentSublistValue({
                        sublistId: 'recmachcustrecord_vs_parent_new',
                        fieldId: 'custrecord_vs_availableqty',
                        value: quantityAvailable
                    });

                    return false;
                });

            }

        } catch (error) {
            log.error('ERROR fieldChanged', error);
        }
    }


    function validateLine(context) {
        try {

            var rec = context.currentRecord;
            var sublistId = 'recmachcustrecord_vs_parent_new';

            var selectedItem = rec.getCurrentSublistValue({
                sublistId: sublistId,
                fieldId: 'custrecord_vs_item_new'
            });

            var quantityAvailable = rec.getCurrentSublistValue({
                sublistId: sublistId,
                fieldId: 'custrecord_vs_availableqty'
            });

            var requestedQty = rec.getCurrentSublistValue({
                sublistId: sublistId,
                fieldId: 'custrecord_vs_quantity_new'
            });

            var customForm = rec.getValue('customform');

            log.debug('Requested Qty', requestedQty);
            log.debug('Available Qty', quantityAvailable);
            log.debug('Selected Item', selectedItem);
            log.debug('Custom Form', customForm);

            /**
             * FORM VALIDATION
             */
            if (customForm == 193) {

                if (selectedItem != 2748 && selectedItem != 6081) {

                    showMessage('You can only choose Lensme Multi Purpose Solution 60 ml or Lensme Multi Purpose Solution 60 ml - Italy for Solution form.');

                    return false;
                }
            }

            /**
             * QTY VALIDATION
             */
            if (parseFloat(requestedQty) > parseFloat(quantityAvailable) || quantityAvailable == '') {

                var errorMsg = 'Requested quantity cannot exceed available quantity (' + quantityAvailable + ')';

                showMessage(errorMsg);

                return false;
            }

            return true;

        } catch (error) {
            log.error('ERROR validateLine', error);
        }
    }


    function showMessage(msg) {
        try {

            var myMsg = message.create({
                title: 'Validation Error',
                message: msg,
                type: message.Type.ERROR
            });

            myMsg.show();

        } catch (error) {
            log.error('ERROR showMessage', error);
        }
    }


    return {
        fieldChanged: fieldChanged,
        validateLine: validateLine
    };

});