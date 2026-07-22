/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */

define(['N/search', 'N/log'],
    function (search, log) {

        function fieldChanged(context) {
            try {
                var rec = context.currentRecord;

                // Run only when the field changed is custitem_vs_itemcategory
                if (context.fieldId !== 'custitem_vs_itemcategory') {
                    return;
                }

                var itemCategoryId = rec.getValue('custitem_vs_itemcategory');

                // If empty, stop
                if (!itemCategoryId) {
                    return;
                }

                // Search customrecord_vs_itemcatkist
                var itemCatSearch = search.create({
                    type: "customrecord_vs_itemcatkist",
                    filters: [
                        ["internalid", "anyof", itemCategoryId]
                    ],
                    columns: [
                        search.createColumn({ name: "custrecord_vs_cogs_account" }),
                        search.createColumn({ name: "custrecord_vs_asset_account" }),
                        search.createColumn({ name: "custrecord_vs_income_account" })
                    ]
                });

                var resultSet = itemCatSearch.run().getRange({ start: 0, end: 1 });

                if (!resultSet || resultSet.length === 0) {
                    alert("No matching Category found in customrecord_vs_itemcatkist.");
                    return;
                }

                var row = resultSet[0];

                var cogsAccount = row.getValue("custrecord_vs_cogs_account");
                var assetAccount = row.getValue("custrecord_vs_asset_account");
                var incomeAccount = row.getValue("custrecord_vs_income_account");

                log.debug("Category Values", {
                    cogsAccount: cogsAccount,
                    assetAccount: assetAccount,
                    incomeAccount: incomeAccount
                });

                // Set field values ONLY if they have values
                if (cogsAccount) {
                    rec.setValue({ fieldId: 'cogsaccount', value: cogsAccount });
                }

                if (assetAccount) {
                    rec.setValue({ fieldId: 'assetaccount', value: assetAccount });
                }

                if (incomeAccount) {
                    rec.setValue({ fieldId: 'incomeaccount', value: incomeAccount });
                }

            } catch (e) {
                log.error("Error in fieldChanged", e);
                alert("Error occurred: " + e.message);
            }
        }

        return {
            fieldChanged: fieldChanged
        };

    });
