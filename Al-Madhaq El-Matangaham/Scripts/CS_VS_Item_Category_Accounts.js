/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Item Category Accounts
 */
define(['N/record', 'N/log'], function (record, log) {

    function fieldChanged(context) {
        try {
            var currentRecord = context.currentRecord;
            var fieldId = context.fieldId;

            log.debug({
                title: 'fieldChanged Triggered',
                details: 'fieldId=' + fieldId
            });

            if (fieldId !== 'custitem_vs_itemcategory') {
                return;
            }

            var itemCategoryId = currentRecord.getValue({ fieldId: 'custitem_vs_itemcategory' });

            log.debug({
                title: 'custitem_vs_itemcategory Changed',
                details: 'Selected Value (ID)=' + itemCategoryId
            });

            // If field cleared, do nothing (or you can clear accounts if you want)
            if (!itemCategoryId) {
                log.debug({
                    title: 'No Category Selected',
                    details: 'custitem_vs_itemcategory is empty, skipping.'
                });
                return;
            }

            // Load the custom record using the selected value as the record ID
            var cateRec = record.load({
                type: 'customrecord_vs_itemcate_list',
                id: itemCategoryId,
                isDynamic: false
            });

            var cogsAccount = cateRec.getValue({ fieldId: 'custrecord_vs_cogs_account' });
            var assetAccount = cateRec.getValue({ fieldId: 'custrecord_vs_asset_account' });

            log.debug({
                title: 'Custom Record Values',
                details: 'cogsAccount=' + cogsAccount + ', assetAccount=' + assetAccount
            });

            // Set values on the Item record
            if (cogsAccount) {
                currentRecord.setValue({
                    fieldId: 'cogsaccount',
                    value: cogsAccount,
                    ignoreFieldChange: true
                });
            }

            if (assetAccount) {
                currentRecord.setValue({
                    fieldId: 'assetaccount',
                    value: assetAccount,
                    ignoreFieldChange: true
                });
            }

            log.debug({
                title: 'Item Updated',
                details: 'Updated fields: cogsaccount / assetaccount'
            });

        } catch (e) {
            log.error({
                title: 'Error in fieldChanged',
                details: (e && e.name ? e.name + ': ' : '') + (e && e.message ? e.message : e)
            });
        }
    }

    return {
        fieldChanged: fieldChanged
    };
});