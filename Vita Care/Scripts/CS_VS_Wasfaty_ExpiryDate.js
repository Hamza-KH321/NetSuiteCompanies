/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Wasfaty Expiry Date
 */
define(['N/currentRecord'], function (currentRecord) {

    function fieldChanged(context) {
        var record = context.currentRecord;
        var fieldId = context.fieldId;

        try {
            console.log("fieldChanged Triggered. Field:", fieldId);

            // Run only when these fields change
            if (fieldId === 'custbody_vs_potype' || fieldId === 'custbody_vs_po_class_type') {

                var classTypeValue = record.getText({fieldId: 'custbody_vs_po_class_type'});

                console.log("Class Type Value:", classTypeValue);

                var today = new Date();
                var expiryDate = null;

                // Private Label
                if (classTypeValue === "Private Label") {

                    console.log("Private Label selected → Adding 180 days");

                    expiryDate = new Date(today);
                    expiryDate.setDate(expiryDate.getDate() + 180);

                } else {

                    // PO Type = 3 (Wasfaty)
                    var poTypeValue = record.getValue({fieldId: 'custbody_vs_potype'});

                    console.log("PO Type Value:", poTypeValue);

                    if (poTypeValue == 3) {

                        console.log("Wasfaty selected → Setting expiry to last day of month");

                        var year = today.getFullYear();
                        var month = today.getMonth() + 1;

                        var lastDay = new Date(year, month, 0).getDate();
                        expiryDate = new Date(year, month - 1, lastDay);
                    }
                }

                // Set expiry date if calculated
                if (expiryDate) {

                    var formattedDate =
                        String(expiryDate.getDate()).padStart(2, '0') + '/' +
                        String(expiryDate.getMonth() + 1).padStart(2, '0') + '/' +
                        expiryDate.getFullYear();

                    console.log("Setting Expiry Date:", formattedDate);

                    record.setText({fieldId: 'custbody_vs_poexpirydate',text: formattedDate});
                }
            }

        } catch (error) {
            console.log("Error in fieldChanged:", error);
        }
    }

    return {
        fieldChanged: fieldChanged
    };
});
