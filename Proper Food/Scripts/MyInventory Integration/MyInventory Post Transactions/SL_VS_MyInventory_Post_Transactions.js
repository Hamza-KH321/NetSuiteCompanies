/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || MyInventory Post Transactions
 */
define(['N/ui/serverWidget', 'N/task', 'N/format', 'N/redirect', 'N/runtime', 'N/cache', 'N/log'],
    function (serverWidget, task, format, redirect, runtime, cache, log) {

        var CONFIG = {
            MR_SCRIPT_ID: 'customscript_vs_mr_myinventory_post_tran',
            MR_DEPLOYMENT_ID: 'customdeploy_vs_mr_myinventory_post_tran',
            PARAM_DATE: 'custscript_vs_myinv_mr_date',
            RESULT_CACHE_NAME: 'VS_MYINV_POST_RESULT',
            REFRESH_SECONDS: 5
        };

        var COLORS = {
            info: { bg: '#e8f1fb', fg: '#125ab2' },
            ok: { bg: '#e6f4ea', fg: '#1e8e3e' },
            error: { bg: '#fdecea', fg: '#c62828' }
        };

        // Stages this Map/Reduce uses. "order" is the real NetSuite stage order; "from" and "to" are the bar percentages of each stage.
        // To show the Reduce stage, add { key: 'REDUCE', label: 'Reduce', order: 3, from: .., to: .. } and adjust the percentages.
        var STAGES = [
            { key: 'GET_INPUT', label: 'Get Input Data', order: 0, from: 5, to: 30 },
            { key: 'MAP', label: 'Map (create vendor bills)', order: 1, from: 30, to: 90 },
            { key: 'SUMMARIZE', label: 'Summarize', order: 4, from: 90, to: 99 }
        ];

        var STAGE_ORDER = { GET_INPUT: 0, MAP: 1, SHUFFLE: 2, REDUCE: 3, SUMMARIZE: 4 };

        function pad2(n) {
            return (n < 10 ? '0' : '') + n;
        }

        function box(color, text, refresh) {
            return '<div style="margin:10px 0;padding:10px 14px;border-radius:4px;font-size:13px;font-weight:600;background:' + color.bg + ';color:' + color.fg + '">' + text + '</div>' +
                (refresh ? refreshScript() : '');
        }

        function refreshScript() {
            return '<script>setTimeout(function(){window.location.reload();},' + (CONFIG.REFRESH_SECONDS * 1000) + ');</script>';
        }

        function getResultCache() {
            return cache.getCache({ name: CONFIG.RESULT_CACHE_NAME, scope: cache.Scope.PUBLIC });
        }

        function readResult(ymd) {
            if (!ymd) return null;
            try {
                var value = getResultCache().get({ key: 'date_' + ymd });
                return value ? JSON.parse(value) : null;
            } catch (e) {
                log.debug({ title: 'Could not read the posting result', details: e.message });
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
                tile('Created', result.created, '#1e8e3e') +
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

        function buildProgress(st) {
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
                                detail = (total - pending) + ' of ' + total + ' invoices processed';
                            }
                        }
                        percent = Math.max(percent, s.from + (s.to - s.from) * ratio);
                    }
                }
            }
            return { percent: Math.round(percent), detail: detail };
        }

        function buildChips(st) {
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
                html += '<span style="display:inline-block;margin:0 8px 6px 0;padding:5px 12px;border-radius:14px;font-size:12px;font-weight:600;background:' + bg + ';color:' + fg + '">' + mark + s.label + '</span>';
            }
            return html;
        }

        function buildForm(message) {
            var form = serverWidget.createForm({ title: 'Post MyInventory Transactions' });
            var dateField = form.addField({ id: 'custpage_posting_date', type: serverWidget.FieldType.DATE, label: 'Date' });
            dateField.isMandatory = true;
            if (message) {
                var msg = form.addField({ id: 'custpage_message', type: serverWidget.FieldType.INLINEHTML, label: ' ' });
                msg.defaultValue = message;
            }
            form.addSubmitButton({ label: 'Post MyInventory Transactions' });
            return form;
        }

        function statusMessage(taskId, postDate, ymd) {
            var st = task.checkStatus({ taskId: taskId });
            var dateText = postDate ? ' for ' + postDate : '';
            var progress = buildProgress(st);
            var running = st.status !== 'COMPLETE' && st.status !== 'FAILED';

            var barColor = '#125ab2';
            var title = '';
            if (st.status === 'COMPLETE') {
                barColor = '#1e8e3e';
                title = 'Posting' + dateText + ' is complete. Any invoice that could not be posted was logged in the MyInventory Integration error records.';
            } else if (st.status === 'FAILED') {
                barColor = '#c62828';
                title = 'Posting' + dateText + ' failed. Please check the MyInventory Integration error records.';
            } else if (st.status === 'PENDING') {
                title = 'Posting' + dateText + ' is waiting to start.';
            } else {
                title = 'Posting' + dateText + ' is running - current stage: ' + stageLabel(st.stage) + '.';
            }

            var html = '<div style="margin:10px 0;max-width:900px;font-size:13px">' +
                '<div style="font-weight:600;margin-bottom:10px">' + title + '</div>' +
                '<div>' + buildChips(st) + '</div>' +
                '<div style="position:relative;height:26px;background:#e6ebef;border-radius:13px;overflow:hidden">' +
                '<div style="height:100%;width:' + progress.percent + '%;background:' + barColor + ';transition:width .4s ease"></div>' +
                '<div style="position:absolute;left:0;right:0;top:0;line-height:26px;text-align:center;font-weight:700;color:#1b2a3a;text-shadow:0 0 3px #fff">' + progress.percent + '%</div>' +
                '</div>' +
                '<div style="margin-top:6px;color:#4b5a68">' + (progress.detail ? progress.detail + '. ' : '') +
                (running ? 'This page refreshes every ' + CONFIG.REFRESH_SECONDS + ' seconds.' : '') + '</div>' +
                (st.status === 'COMPLETE' ? buildResult(readResult(ymd)) : '') +
                '</div>';
            return html + (running ? refreshScript() : '');
        }

        function onRequest(ctx) {
            var p = ctx.request.parameters;

            if (ctx.request.method === 'POST') {
                try {
                    if (!p.custpage_posting_date) {
                        throw new Error('Please select a date.');
                    }
                    var picked = format.parse({ value: p.custpage_posting_date, type: format.Type.DATE });
                    var ymd = picked.getFullYear() + '-' + pad2(picked.getMonth() + 1) + '-' + pad2(picked.getDate());
                    var params = {};
                    params[CONFIG.PARAM_DATE] = ymd;
                    try {
                        getResultCache().remove({ key: 'date_' + ymd });
                    } catch (cacheError) {
                        log.debug({ title: 'Could not clear the previous result', details: cacheError.message });
                    }
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
                        parameters: { taskid: taskId, postdate: p.custpage_posting_date, ymd: ymd }
                    });
                    return;
                } catch (e) {
                    log.error({ title: 'Post MyInventory Transactions', details: e });
                    ctx.response.writePage(buildForm(box(COLORS.error, 'Could not start the posting: ' + (e.message || e), false)));
                    return;
                }
            }

            var message = '';
            if (p.taskid) {
                try {
                    message = statusMessage(p.taskid, p.postdate, p.ymd);
                } catch (e) {
                    message = box(COLORS.error, 'Could not read the posting status: ' + (e.message || e), false);
                }
            }
            ctx.response.writePage(buildForm(message));
        }

        return {
            onRequest: onRequest
        };
    });