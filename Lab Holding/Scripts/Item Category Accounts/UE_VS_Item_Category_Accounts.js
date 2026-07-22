/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

define(['N/record', 'N/search', 'N/error', 'N/log'],
    function (record, search, error, log) {

        function beforeSubmit(context) {
            try {

                // Run only on CREATE or EDIT
                if (context.type !== context.UserEventType.CREATE &&
                    context.type !== context.UserEventType.EDIT) {

                    log.debug("Skip", "Not a create or edit event.");
                    return;
                }
                
                var newRec = context.newRecord;

                // 1. Get the item category
                var itemCategoryId = newRec.getValue('custitem_vs_itemcategory');

                // 2. Validate: Item category must have value
                if (!itemCategoryId) {
                    return;
                }

                // 3. Run search on customrecord_vs_itemcatkist
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
                    throw error.create({
                        name: 'CATEGORY_NOT_FOUND',
                        message: 'The selected Item Category record was not found in customrecord_vs_itemcatkist.'
                    });
                }

                var row = resultSet[0];

                // 4. Extract values
                var cogsAccount = row.getValue("custrecord_vs_cogs_account");
                var assetAccount = row.getValue("custrecord_vs_asset_account");
                var incomeAccount = row.getValue("custrecord_vs_income_account");

                log.debug('Category Values', {
                    cogsAccount: cogsAccount,
                    assetAccount: assetAccount,
                    incomeAccount: incomeAccount
                });

                // 5. Set fields only if value exists
                if (cogsAccount) {
                    newRec.setValue({ fieldId: 'cogsaccount', value: cogsAccount });
                }

                if (assetAccount) {
                    newRec.setValue({ fieldId: 'assetaccount', value: assetAccount });
                }

                // IMPORTANT: You said incomeaccount = *custrecord_vs_cogs_account*
                if (incomeAccount) {
                    newRec.setValue({ fieldId: 'incomeaccount', value: incomeAccount });
                }

            } catch (e) {
                log.error('Error in beforeSubmit', e);
                throw e;
            }
        }

        return {
            beforeSubmit: beforeSubmit
        };

    });
