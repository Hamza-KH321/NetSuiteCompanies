/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || MyInventory Delete Transactions
 */
define(['N/ui/serverWidget', 'N/task', 'N/format', 'N/redirect', 'N/runtime', 'N/cache', 'N/log'],
    function (serverWidget, task, format, redirect, runtime, cache, log) {

        var CONFIG = {
            MR_SCRIPT_ID: 'customscript_vs_mr_myinventory_delete_tr',
            MR_DEPLOYMENT_ID: 'customdeploy_vs_mr_myinventory_delete_tr',
            PARAM_DATE_FROM: 'custscript_vs_myinv_del_date_from',
            PARAM_DATE_TO: 'custscript_vs_myinv_del_date_to',
            PARAM_TYPE: 'custscript_vs_myinv_del_type',
            TYPE_BILL: 'BILL',
            TYPE_ERROR: 'ERROR',
            RESULT_CACHE_NAME: 'VS_MYINV_DELETE_RESULT',
            REFRESH_SECONDS: 5
        };

        var COLORS = {
            info: { bg: '#e8f1fb', fg: '#125ab2' },
            error: { bg: '#fdecea', fg: '#c62828' }
        };

        // "order" is the real NetSuite stage order; "from" and "to" are the bar percentages of each stage.
        var STAGES = [
            { key: 'GET_INPUT', label: 'Get Input Data', order: 0, from: 5, to: 30 },
            { key: 'MAP', label: 'Map (delete)', order: 1, from: 30, to: 90 },
            { key: 'SUMMARIZE', label: 'Summarize', order: 4, from: 90, to: 99 }
        ];

        var STAGE_ORDER = { GET_INPUT: 0, MAP: 1, SHUFFLE: 2, REDUCE: 3, SUMMARIZE: 4 };

        function pad2(n) {
            return (n < 10 ? '0' : '') + n;
        }

        function toYmd(date) {
            return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
        }

        function isErrorType(type) {
            return type === CONFIG.TYPE_ERROR;
        }

        function mapLabel(type) {
            return isErrorType(type) ? 'Map (delete error log)' : 'Map (delete vendor bills)';
        }

        function refreshScript() {
            return '<script>setTimeout(function(){window.location.reload();},' + (CONFIG.REFRESH_SECONDS * 1000) + ');</script>';
        }

        function box(color, text) {
            return '<div style="margin:10px 0;padding:10px 14px;border-radius:4px;font-size:13px;font-weight:600;background:' + color.bg + ';color:' + color.fg + '">' + text + '</div>';
        }

        function getResultCache() {
            return cache.getCache({ name: CONFIG.RESULT_CACHE_NAME, scope: cache.Scope.PUBLIC });
        }

        function readResult(resultKey) {
            if (!resultKey) return null;
            try {
                var value = getResultCache().get({ key: resultKey });
                return value ? JSON.parse(value) : null;
            } catch (e) {
                log.debug({ title: 'Could not read the delete result', details: e.message });
                return null;
            }
        }

        function tile(label, value, color) {
            return '<div style="min-width:130px;padding:10px 16px;border-radius:6px;background:#f4f6f8;border:1px solid #e1e6ea">' +
                '<div style="font-size:11px;font-weight:600;color:#6b7885;text-transform:uppercase">' + label + '</div>' +
                '<div style="font-size:22px;font-weight:700;color:' + color + '">' + value + '</div></div>';
        }

        function buildResult(result) {
            if (!result) {
                return '<div style="margin-top:12px;color:#6b7885">The result summary is no longer available. Please check the MyInventory Integration error records.</div>';
            }
            return '<div style="margin-top:14px;font-weight:600">Summary</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:8px">' +
                tile('Deleted', result.deleted, '#1e8e3e') +
                tile('Failed', result.failed, result.failed > 0 ? '#c62828' : '#2b2b2b') +
                tile('Seconds', result.seconds, '#2b2b2b') +
                tile('Usage', result.usage, '#2b2b2b') +
                '</div>';
        }

        function readNumber(obj, methodName) {
            try {
                if (obj && typeof obj[methodName] === 'function') {
                    return Number(obj[methodName]()) || 0;
                }
            } catch (e) {
                log.debug({ title: 'Status method not available', details: methodName });
            }
            return 0;
        }

        function stageLabel(stage) {
            var text = String(stage || '').replace(/_/g, ' ').toLowerCase();
            return text.charAt(0).toUpperCase() + text.slice(1);
        }

        function buildProgress(st, type) {
            var cur = STAGE_ORDER[st.stage];
            var percent = 0;
            var detail = '';

            if (st.status === 'COMPLETE') {
                percent = 100;
            } else if (st.status === 'PENDING' || cur === undefined) {
                percent = 2;
            } else {
                percent = STAGES[0].from;
                for (var i = 0; i < STAGES.length; i++) {
                    var s = STAGES[i];
                    if (s.order < cur) {
                        percent = Math.max(percent, s.to);
                    } else if (s.order === cur) {
                        var ratio = 0;
                        if (s.key === 'MAP') {
                            var total = readNumber(st, 'getTotalMapCount');
                            var pending = readNumber(st, 'getPendingMapCount');
                            if (total > 0) {
                                ratio = Math.max(0, Math.min(1, (total - pending) / total));
                                detail = (total - pending) + ' of ' + total + (isErrorType(type) ? ' error records' : ' vendor bills') + ' processed';
                            }
                        }
                        percent = Math.max(percent, s.from + (s.to - s.from) * ratio);
                    }
                }
            }
            return { percent: Math.round(percent), detail: detail };
        }

        function buildChips(st, type) {
            var cur = STAGE_ORDER[st.stage];
            var html = '';
            for (var i = 0; i < STAGES.length; i++) {
                var s = STAGES[i];
                var bg = '#e6ebef';
                var fg = '#6b7885';
                var mark = '';
                if (st.status === 'COMPLETE' || (cur !== undefined && s.order < cur)) {
                    bg = '#e6f4ea'; fg = '#1e8e3e'; mark = '&#10003; ';
                } else if (cur !== undefined && s.order === cur && st.status === 'FAILED') {
                    bg = '#fdecea'; fg = '#c62828'; mark = '&#10007; ';
                } else if (cur !== undefined && s.order === cur) {
                    bg = '#e8f1fb'; fg = '#125ab2'; mark = '&#9679; ';
                }
                html += '<span style="display:inline-block;margin:0 8px 6px 0;padding:5px 12px;border-radius:14px;font-size:12px;font-weight:600;background:' + bg + ';color:' + fg + '">' + mark + (s.key === 'MAP' ? mapLabel(type) : s.label) + '</span>';
            }
            return html;
        }

        function buildForm(message) {
            var form = serverWidget.createForm({ title: 'Delete MyInventory Transactions' });

            var notice = form.addField({ id: 'custpage_notice', type: serverWidget.FieldType.INLINEHTML, label: ' ' });
            notice.defaultValue = box(COLORS.error, 'Only vendor bills created by the MyInventory integration are deleted. A deleted vendor bill cannot be recovered.' +
                '<br>Vendor bills are selected by their transaction date. Error log records are selected by the date they were created.');

            // Each group is its own block, so the option and the dates always sit on separate lines.
            form.addFieldGroup({ id: 'custpage_grp_type', label: 'Delete' });
            var typeField = form.addField({ id: 'custpage_delete_type', type: serverWidget.FieldType.SELECT, label: 'Delete Option', container: 'custpage_grp_type' });
            typeField.addSelectOption({ value: '', text: '' });
            typeField.addSelectOption({ value: CONFIG.TYPE_BILL, text: 'Delete Vendor Bill' });
            typeField.addSelectOption({ value: CONFIG.TYPE_ERROR, text: 'Delete Error Log' });
            typeField.isMandatory = true;

            form.addFieldGroup({ id: 'custpage_grp_dates', label: 'Date Range' });
            var fromField = form.addField({ id: 'custpage_date_from', type: serverWidget.FieldType.DATE, label: 'Date From', container: 'custpage_grp_dates' });
            fromField.isMandatory = true;
            fromField.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.STARTROW });
            var toField = form.addField({ id: 'custpage_date_to', type: serverWidget.FieldType.DATE, label: 'Date To', container: 'custpage_grp_dates' });
            toField.isMandatory = true;
            toField.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.ENDROW });

            if (message) {
                var msg = form.addField({ id: 'custpage_message', type: serverWidget.FieldType.INLINEHTML, label: ' ' });
                msg.defaultValue = message;
            }
            form.addSubmitButton({ label: 'Delete' });
            return form;
        }

        function statusMessage(taskId, fromText, toText, resultKey, type) {
            var st = task.checkStatus({ taskId: taskId });
            var rangeText = fromText ? ' for ' + fromText + ' - ' + toText : '';
            var progress = buildProgress(st, type);
            var running = st.status !== 'COMPLETE' && st.status !== 'FAILED';

            var what = isErrorType(type) ? 'error log records' : 'vendor bills';
            var failedHint = isErrorType(type)
                ? 'Any record that could not be deleted is listed in the script execution log.'
                : 'Any vendor bill that could not be deleted was logged in the MyInventory Integration error records.';
            var barColor = '#125ab2';
            var title = '';
            if (st.status === 'COMPLETE') {
                barColor = '#1e8e3e';
                title = 'Deleting ' + what + rangeText + ' is complete. ' + failedHint;
            } else if (st.status === 'FAILED') {
                barColor = '#c62828';
                title = 'Deleting ' + what + rangeText + ' failed. ' + (isErrorType(type) ? 'Please check the script execution log.' : 'Please check the MyInventory Integration error records.');
            } else if (st.status === 'PENDING') {
                title = 'Deleting ' + what + rangeText + ' is waiting to start.';
            } else {
                title = 'Deleting ' + what + rangeText + ' is running - current stage: ' + stageLabel(st.stage) + '.';
            }

            var html = '<div style="margin:10px 0;max-width:900px;font-size:13px">' +
                '<div style="font-weight:600;margin-bottom:10px">' + title + '</div>' +
                '<div>' + buildChips(st, type) + '</div>' +
                '<div style="position:relative;height:26px;background:#e6ebef;border-radius:13px;overflow:hidden">' +
                '<div style="height:100%;width:' + progress.percent + '%;background:' + barColor + ';transition:width .4s ease"></div>' +
                '<div style="position:absolute;left:0;right:0;top:0;line-height:26px;text-align:center;font-weight:700;color:#1b2a3a;text-shadow:0 0 3px #fff">' + progress.percent + '%</div>' +
                '</div>' +
                '<div style="margin-top:6px;color:#4b5a68">' + (progress.detail ? progress.detail + '. ' : '') +
                (running ? 'This page refreshes every ' + CONFIG.REFRESH_SECONDS + ' seconds.' : '') + '</div>' +
                (st.status === 'COMPLETE' ? buildResult(readResult(resultKey)) : '') +
                '</div>';
            return html + (running ? refreshScript() : '');
        }

        function onRequest(ctx) {
            var p = ctx.request.parameters;

            if (ctx.request.method === 'POST') {
                try {
                    var type = String(p.custpage_delete_type || '');
                    if (type !== CONFIG.TYPE_BILL && type !== CONFIG.TYPE_ERROR) {
                        throw new Error('Please select what to delete: Delete Vendor Bill or Delete Error Log.');
                    }
                    if (!p.custpage_date_from || !p.custpage_date_to) {
                        throw new Error('Please select Date From and Date To.');
                    }
                    var from = toYmd(format.parse({ value: p.custpage_date_from, type: format.Type.DATE }));
                    var to = toYmd(format.parse({ value: p.custpage_date_to, type: format.Type.DATE }));
                    if (from > to) {
                        throw new Error('Date From cannot be after Date To.');
                    }
                    var resultKey = 'del_' + type + '_' + from + '_' + to;

                    try {
                        getResultCache().remove({ key: resultKey });
                    } catch (cacheError) {
                        log.debug({ title: 'Could not clear the previous result', details: cacheError.message });
                    }

                    var params = {};
                    params[CONFIG.PARAM_DATE_FROM] = from;
                    params[CONFIG.PARAM_DATE_TO] = to;
                    params[CONFIG.PARAM_TYPE] = type;
                    var taskId = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: CONFIG.MR_SCRIPT_ID,
                        deploymentId: CONFIG.MR_DEPLOYMENT_ID,
                        params: params
                    }).submit();

                    var self = runtime.getCurrentScript();
                    redirect.toSuitelet({
                        scriptId: self.id,
                        deploymentId: self.deploymentId,
                        parameters: { taskid: taskId, fromtext: p.custpage_date_from, totext: p.custpage_date_to, rk: resultKey, dt: type }
                    });
                    return;
                } catch (e) {
                    log.error({ title: 'Delete MyInventory Vendor Bills', details: e });
                    ctx.response.writePage(buildForm(box(COLORS.error, 'Could not start the deletion: ' + (e.message || e))));
                    return;
                }
            }

            var message = '';
            if (p.taskid) {
                try {
                    message = statusMessage(p.taskid, p.fromtext, p.totext, p.rk, p.dt);
                } catch (e) {
                    message = box(COLORS.error, 'Could not read the deletion status: ' + (e.message || e));
                }
            }
            ctx.response.writePage(buildForm(message));
        }

        return {
            onRequest: onRequest
        };
    });