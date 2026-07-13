/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/url'], function (currentRecord, url) {

    var suiteletWindow = null;
    var selectedItemsBuffer = []; // Stores selected items until Suitelet closes

    function pageInit(context) {

        // Ensure event listener is added only once when the Sales Order page loads
        if (context.mode === 'create' || context.mode === 'edit') {
            window.addEventListener('message', handleMessage, false);
        }
    }

    function openItemSelection(suiteletUrl) {

        try {
            suiteletWindow = window.open(suiteletUrl, 'ItemSelection', 'width=700,height=600,scrollbars=yes');

            // Check every second if the Suitelet window is closed
            var checkWindowClosed = setInterval(function () {
                if (suiteletWindow && suiteletWindow.closed) {
                    clearInterval(checkWindowClosed);

                    console.log("openItemSelection - setInterval");
                    console.log(selectedItemsBuffer);

                    if (selectedItemsBuffer.length > 0) {
                        processStoredItems();
                    } else {
                        console.warn("⚠️ No items were selected from Suitelet.");
                    }
                }
            }, 2000);

        } catch (e) {
            console.error("❌ Error opening Suitelet:", e);
        }
    }

    function handleMessage(event) {
    
        // Ensure the message is from the Suitelet
        if (!event.data || typeof event.data !== 'object' || !event.data.action) {
            console.warn("⚠️ Ignored message event. Invalid data format.");
            return;
        }
    
        if (event.data.action !== 'addItems') {
            console.warn("⚠️ Ignored message event. Wrong action type:", event.data.action);
            return;
        }
    
        try {
            selectedItemsBuffer = event.data.items; // Store selected items
            console.log("selectedItemsBuffer");
            console.log(event.data.items);
    
        } catch (e) {
            console.error("❌ Error processing selected items in handleMessage:", e);
        }
    }
    
    function processStoredItems() {

        if (selectedItemsBuffer.length === 0) {
            console.warn("⚠️ No items to process.");
            return;
        }

        try {
            var rec = currentRecord.get();
            var sublistId = 'item';

            for (var i = 0; i < selectedItemsBuffer.length; i++) {
                var itemData = selectedItemsBuffer[i]; // Now an object { itemId, quantity }

                freeze(1000); // Simulate delay to avoid UI lag

                rec.selectNewLine({ sublistId: sublistId });

                rec.setCurrentSublistValue({
                    sublistId: sublistId,
                    fieldId: 'item',
                    value: itemData.itemId,
                    ignoreFieldChange: true
                });

                rec.setCurrentSublistValue({
                    sublistId: sublistId,
                    fieldId: 'quantity',
                    value: itemData.quantity,
                    ignoreFieldChange: true
                });

                rec.setCurrentSublistValue({
                    sublistId: sublistId,
                    fieldId: 'amount',
                    value: 1 // Default value
                });

                rec.commitLine({ sublistId: sublistId });
            }

        } catch (e) {
            console.error("❌ Error adding selected items to sublist:", e);
        }

        // Clear the buffer after processing
        selectedItemsBuffer = [];
    }

    function freeze(ms) {
        var start = Date.now();
        while (Date.now() - start < ms) {
            // Do nothing, just block execution
        }
    }

    function postSelectedItems() {

        try {
            var selectedItems = [];
            var rec = currentRecord.get();
            var lineCount = rec.getLineCount({ sublistId: 'custpage_item_sublist' });

            for (var i = 0; i < lineCount; i++) {
                var itemId = rec.getSublistValue({
                    sublistId: 'custpage_item_sublist',
                    fieldId: 'custpage_item',
                    line: i
                });

                var quantity = rec.getSublistValue({
                    sublistId: 'custpage_item_sublist',
                    fieldId: 'custpage_quantity',
                    line: i
                });


                selectedItems.push({
                    itemId: itemId,
                    quantity: quantity
                });
            }

            if (selectedItems.length === 0) {
                alert("⚠️ Please select at least one item.");
                console.warn("⚠️ No items selected. Exiting postSelectedItems().");
                return;
            }

            window.opener.postMessage({ action: 'addItems', items: selectedItems }, '*');
            window.close();

        } catch (e) {
            console.error("❌ Error in postSelectedItems:", e);
        }
    }

    return {
        pageInit: pageInit,
        openItemSelection: openItemSelection,
        postSelectedItems: postSelectedItems
    };
});
