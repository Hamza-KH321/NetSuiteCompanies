/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function(record, log) {
    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
            return;
        }

        var newRecord = context.newRecord;
        var itemCountNormal = newRecord.getLineCount({ sublistId: 'item' });
        var itemCountExpense = newRecord.getLineCount({ sublistId: 'expense' });

if (itemCountNormal > 0 ){
    log.debug('Items list will be modified',itemCountNormal);
        for (var i = itemCountNormal - 1; i >= 0; i--) {
            var isDelete = newRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_vs_delete',
                line: i
            });

            log.debug({
                title: 'Line ' + i + ' - Delete Status',
                details: isDelete
            });

            if (!isDelete) {
                newRecord.removeLine({
                    sublistId: 'item',
                    line: i,
                    ignoreRecalc: true
                });

                log.audit({
                    title: 'Line Removed',
                    details: 'Removed line ' + i + ' from sublist.'
                });
            }
        }
    } else if (itemCountExpense > 0){
        log.debug('Expense list will be modified',itemCountExpense);

        for (var j = itemCountNormal - 1; j >= 0; j--) {
            var isDelete = newRecord.getSublistValue({
                sublistId: 'expense',
                fieldId: 'custcol_vs_delete',
                line: j
            });

            log.debug({
                title: 'Line ' + j + ' - Delete Status',
                details: isDelete
            });

            if (!isDelete) {
                newRecord.removeLine({
                    sublistId: 'expense',
                    line: j,
                    ignoreRecalc: true
                });

                log.audit({
                    title: 'Line Removed',
                    details: 'Removed line ' + j + ' from sublist.'
                });
            }
        }
        
    }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
