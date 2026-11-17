/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || MyInventory Delete Transactions
 */
define(['N/runtime', 'N/search', 'N/record', 'N/format', 'N/cache', 'N/log'], function (runtime, search, record, format, cache, log) {

    var CONFIG = {
        PARAM_DATE_FROM: 'custscript_vs_myinv_del_date_from',
        PARAM_DATE_TO: 'custscript_vs_myinv_del_date_to',
        PARAM_TYPE: 'custscript_vs_myinv_del_type',
        TYPE_BILL: 'BILL',
        TYPE_ERROR: 'ERROR',
        ERROR_RECORD: 'customrecord_vs_myinventory_integration',
        ERROR_FIELD: 'custrecord_vs_error_message',
        FLAG_FIELD: 'custbody_vs_myinventory_transaction',
        RESULT_CACHE_NAME: 'VS_MYINV_DELETE_RESULT',
        RESULT_CACHE_TTL: 7200,
        MAX_MESSAGE_LENGTH: 300
    };

    function toDisplayDate(ymd) {
        return ymd.slice(8, 10) + '/' + ymd.slice(5, 7) + '/' + ymd.slice(0, 4);
    }

    function toNetSuiteDate(ymd) {
        var p = ymd.split('-');
        return format.format({ value: new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])), type: format.Type.DATE });
    }

    /* ---------- error record ---------- */

    function createErrorRecord(message) {
        try {
            var rec = record.create({ type: CONFIG.ERROR_RECORD });
            rec.setValue({ fieldId: CONFIG.ERROR_FIELD, value: String(message || '').substring(0, CONFIG.MAX_MESSAGE_LENGTH) });
            rec.save();
        } catch (e) {
            log.error({ title: 'Failed to create error record', details: e.name + ': ' + e.message + ' | Original message: ' + message });
        }
    }

    /* ---------- parameters ---------- */

    function getParams() {
        var script = runtime.getCurrentScript();
        var from = String(script.getParameter({ name: CONFIG.PARAM_DATE_FROM }) || '').trim();
        var to = String(script.getParameter({ name: CONFIG.PARAM_DATE_TO }) || '').trim();

        // A date range is always required, so the script can never delete without a limit.
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
            throw new Error('Date From and Date To are required.');
        }
        if (from > to) {
            throw new Error('Date From cannot be after Date To.');
        }

        var type = String(script.getParameter({ name: CONFIG.PARAM_TYPE }) || '').trim().toUpperCase();
        if (type !== CONFIG.TYPE_BILL && type !== CONFIG.TYPE_ERROR) {
            throw new Error('Please select what to delete: vendor bills or the error log.');
        }
        return { from: from, to: to, type: type };
    }

    /* ---------- stages ---------- */

    function getInputData() {
        var params = null;
        try {
            params = getParams();
            var from = toNetSuiteDate(params.from);
            var to = toNetSuiteDate(params.to);

            log.audit({ title: 'MyInventory delete started', details: { type: params.type, from: params.from, to: params.to } });

            // Returning the search lets NetSuite stream the records straight to the map stage.
            if (params.type === CONFIG.TYPE_ERROR) {
                return search.create({
                    type: CONFIG.ERROR_RECORD,
                    filters: [['created', 'within', from, to]],
                    columns: ['created']
                });
            }
            return search.create({
                type: search.Type.VENDOR_BILL,
                filters: [['mainline', 'is', 'T'], 'AND', [CONFIG.FLAG_FIELD, 'is', 'T'], 'AND', ['trandate', 'within', from, to]],
                columns: ['tranid', 'entity', 'trandate']
            });
        } catch (e) {
            log.error({ title: 'Get Input Error', details: e.name + ': ' + e.message });
            // No new error record is created while the error log itself is being deleted.
            if (!params || params.type !== CONFIG.TYPE_ERROR) {
                createErrorRecord('MyInventory vendor bills could not be deleted' +
                    (params ? ' for ' + toDisplayDate(params.from) + ' - ' + toDisplayDate(params.to) : '') + '. Details: ' + e.message);
            }
            throw e;
        }
    }

    function textOf(value) {
        if (value && typeof value === 'object') {
            if (value.length) return textOf(value[0]);
            return String(value.text || value.value || '');
        }
        return String(value || '');
    }

    function describeBill(row) {
        var values = row.values || {};
        var reference = textOf(values.tranid);
        return 'Vendor bill ' + (reference ? reference + ' ' : '') + '(ID ' + row.id + ', vendor ' + textOf(values.entity) + ', date ' + textOf(values.trandate) + ')';
    }

    function friendlyDeleteError(e) {
        var message = String((e && e.message) || e);
        if (/period/i.test(message) && /(closed|locked)/i.test(message)) return 'its posting date falls in a closed or locked accounting period';
        if (/(applied|payment|paid)/i.test(message)) return 'it has a payment or credit applied to it. Remove the payment first';
        if (/permission/i.test(message)) return 'the user does not have permission to delete vendor bills';
        return message;
    }

    function map(context) {
        var row = {};
        var isErrorLog = false;
        try {
            isErrorLog = getParams().type === CONFIG.TYPE_ERROR;
            row = JSON.parse(context.value);
            if (isErrorLog) {
                record.delete({ type: CONFIG.ERROR_RECORD, id: row.id });
                log.audit({ title: 'Error record deleted', details: 'Error record ID ' + row.id });
            } else {
                record.delete({ type: record.Type.VENDOR_BILL, id: row.id });
                log.audit({ title: 'Vendor bill deleted', details: describeBill(row) });
            }
            context.write({ key: 'deleted', value: String(row.id) });
        } catch (e) {
            log.error({ title: 'Map Error', details: (row.id || '') + ' | ' + e.name + ': ' + e.message });
            if (!isErrorLog) {
                createErrorRecord(describeBill(row) + ' could not be deleted: ' + friendlyDeleteError(e));
            }
            context.write({ key: 'failed', value: String(row.id || '') });
        }
    }

    function summarize(summary) {
        var deleted = 0;
        var failed = 0;
        summary.output.iterator().each(function (key) {
            if (key === 'deleted') deleted++;
            else failed++;
            return true;
        });
        if (summary.inputSummary.error) log.error({ title: 'Input stage failed', details: summary.inputSummary.error });
        summary.mapSummary.errors.iterator().each(function (key, error) {
            log.error({ title: 'Map failed: ' + key, details: error });
            return true;
        });

        var result = { deleted: deleted, failed: failed, seconds: summary.seconds, usage: summary.usage };
        log.audit({ title: 'MyInventory delete complete', details: result });

        // Share the result with the Suitelet screen.
        try {
            var params = getParams();
            cache.getCache({ name: CONFIG.RESULT_CACHE_NAME, scope: cache.Scope.PUBLIC }).put({
                key: 'del_' + params.type + '_' + params.from + '_' + params.to,
                value: JSON.stringify(result),
                ttl: CONFIG.RESULT_CACHE_TTL
            });
        } catch (e) {
            log.error({ title: 'Could not store the delete result', details: e.name + ': ' + e.message });
        }
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
});