/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record'], function (record) {

    function beforeSubmit(context) {

        // Run only in Create mode
        if (context.type !== context.UserEventType.CREATE) {
            log.debug("Skipping Script", "Not in Create Mode");
            return;
        }

        var newRecord = context.newRecord;
        var classValues = []; // Store class values
        var sublistId = 'recmachcustrecord_vs_parent'; // Static sublist ID

        var lineCount = newRecord.getLineCount({ sublistId: sublistId });

        // Loop through all lines in the static sublist
        for (var i = 0; i < lineCount; i++) {
            var classValue = newRecord.getSublistValue({
                sublistId: sublistId,
                fieldId: 'custrecord_vs_brand_item',
                line: i
            });

            if (classValue && classValues.indexOf(classValue) == -1) {
                classValues.push(classValue); // Store unique class values
            }
        }

        // Define class value groups
        var cgwClasses = [7, 1, 3, 8]; // Carilex, Genadyne, and WELLEL
        var tfmClasses = [9, 2, 4, 5, 13]; // F-M-T-T, Ferris, Medskin, Tristel, and Tulip
        var urgoClasses = [6, 18]; // URGO and Vashe
        var hoClasses = [10]; // H.O
        var flnClasses = [16, 17]; // U.F and Flen

        // Function to check if any class value exists in a specific group
        function containsClass(classArray) {
            for (var i = 0; i < classValues.length; i++) {
                if (classArray.indexOf(parseInt(classValues[i])) !== -1) {
                    return true;
                }
            }
            return false;
        }

        // Check which brands exist in the items
        var hasCGW = containsClass(cgwClasses);
        var hasTFM = containsClass(tfmClasses);
        var hasURGO = containsClass(urgoClasses);
        var hasHO = containsClass(hoClasses);
        var hasFln = containsClass(flnClasses);

        // Set checkboxes based on class values
        newRecord.setValue({ fieldId: 'custrecord_vs_cgw_brand', value: hasCGW });
        newRecord.setValue({ fieldId: 'custrecord_vs_tfm_brand', value: hasTFM });
        newRecord.setValue({ fieldId: 'custrecord_vs_urgo_brand', value: hasURGO });
        newRecord.setValue({ fieldId: 'custrecord_vs_ho_brand', value: hasHO });
        newRecord.setValue({ fieldId: 'custrecord_vs_flen_brand', value: hasFln });

        // Set "approved" checkboxes if the brand is NOT found
        newRecord.setValue({ fieldId: 'custrecord_vs_cgw_approved', value: !hasCGW });
        newRecord.setValue({ fieldId: 'custrecord_vs_tfm_approved', value: !hasTFM });
        newRecord.setValue({ fieldId: 'custrecord_vs_urgo_approved', value: !hasURGO });
        newRecord.setValue({ fieldId: 'custrecord_vs_ho_approved', value: !hasHO });
        newRecord.setValue({ fieldId: 'custrecord_vs_flen_approved', value: !hasFln });
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
