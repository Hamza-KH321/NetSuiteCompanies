/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || MyInventory Post Transactions
 */
define(['N/sftp', 'N/runtime', 'N/search', 'N/record', 'N/cache', 'N/log'], function (sftp, runtime, search, record, cache, log) {

    var CONFIG = {
        PARAM_SFTP_CONFIG: 'custscript_vs_myinv_mr_sftp_config',
        PARAM_DATE: 'custscript_vs_myinv_mr_date',
        CONFIG_RECORD: 'customrecord_vs_myinv_sftp_configuration',
        ERROR_RECORD: 'customrecord_vs_myinventory_integration',
        ERROR_FIELD: 'custrecord_vs_error_message',
        FLAG_FIELD: 'custbody_vs_myinventory_transaction',
        INVOICE_COLUMN: 'custcol_vs_myinventory_invoice_number',
        IGNORED_ACCOUNT: '187',
        APPROVED_STATUS: 2,
        FILE_REGEX: /^PFR(\d{4})(\d{2})(\d{2})_(\d+)\.csv$/i,
        RESULT_CACHE_NAME: 'VS_MYINV_POST_RESULT',
        RESULT_CACHE_TTL: 7200,
        MAX_MESSAGE_LENGTH: 300,
        SEARCH_CHUNK: 50
    };

    var COL = { INVOICE_DATE: 4, INVOICE: 6, ACCOUNT: 10, MARKER: 13, AMOUNT: 14 };
    var MIN_COLUMNS = 15;

    function pad2(n) {
        return (n < 10 ? '0' : '') + n;
    }

    function toDisplayDate(ymd) {
        return ymd.slice(8, 10) + '/' + ymd.slice(5, 7) + '/' + ymd.slice(0, 4);
    }

    function unique(arr) {
        var seen = {};
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            if (!seen[arr[i]]) {
                seen[arr[i]] = true;
                out.push(arr[i]);
            }
        }
        return out;
    }

    function chunk(arr, size) {
        var out = [];
        for (var i = 0; i < arr.length; i += size) {
            out.push(arr.slice(i, i + size));
        }
        return out;
    }

    function invoiceLabel(fileName, invoiceNumber) {
        return 'Invoice ' + invoiceNumber + ' (file ' + fileName + ')';
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

    /* ---------- SFTP ---------- */

    function getSftpConfig(configId) {
        var configRec = record.load({ type: CONFIG.CONFIG_RECORD, id: configId });
        if (configRec.getValue({ fieldId: 'isinactive' })) {
            throw new Error('MyInventory SFTP configuration is inactive.');
        }
        var config = {
            host: String(configRec.getValue({ fieldId: 'custrecord_vs_myinv_sftp_host' }) || '').trim(),
            port: Number(configRec.getValue({ fieldId: 'custrecord_vs_myinv_sftp_port' }) || 22),
            username: String(configRec.getValue({ fieldId: 'custrecord_vs_myinv_sftp_username' }) || '').trim(),
            directory: String(configRec.getValue({ fieldId: 'custrecord_vs_myinv_sftp_directory' }) || '').trim(),
            hostKey: String(configRec.getValue({ fieldId: 'custrecord_vs_myinv_sftp_hostkey' }) || '').trim(),
            passwordGuid: 'custsecret_vs_sym_sftp_password_guid'
        };
        if (!config.host || !config.username || !config.directory || !config.hostKey || !config.passwordGuid) {
            throw new Error('MyInventory SFTP configuration is missing host, username, directory, host key or password GUID.');
        }
        if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
            throw new Error('Invalid SFTP port.');
        }
        return config;
    }

    function connect() {
        var configId = runtime.getCurrentScript().getParameter({ name: CONFIG.PARAM_SFTP_CONFIG });
        if (!configId) {
            throw new Error('Script parameter "' + CONFIG.PARAM_SFTP_CONFIG + '" is not set.');
        }
        var config = getSftpConfig(configId);
        return sftp.createConnection({
            url: config.host,
            username: config.username,
            port: config.port,
            directory: config.directory,
            hostKey: config.hostKey,
            passwordGuid: config.passwordGuid
        });
    }

    /* ---------- parameters ---------- */

    function getTargetDate() {
        var param = String(runtime.getCurrentScript().getParameter({ name: CONFIG.PARAM_DATE }) || '').trim();
        if (!param) {
            var d = new Date();
            return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(param)) {
            throw new Error('Invalid date parameter: ' + param);
        }
        return param;
    }

    /* ---------- file parsing ---------- */

    function parseDate(value) {
        var m = /^(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})$/.exec(value || '');
        if (!m) return '';
        var y = Number(m[1]);
        var mo = Number(m[2]);
        var d = Number(m[3]);
        var check = new Date(Date.UTC(y, mo - 1, d));
        if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return '';
        return m[1] + '-' + m[2] + '-' + m[3];
    }

    function parseAmount(value) {
        if (!/^(\d+(\.\d+)?|\.\d+)$/.test(value || '')) return null;
        var amount = Math.round(Number(value) * 100) / 100;
        return amount > 0 ? amount : null;
    }

    function parseFile(fileName, content) {
        var groups = [];
        var index = {};
        var badLines = [];
        var lines = String(content || '').replace(/^﻿/, '').split(/\r?\n/);

        for (var i = 0; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            var cols = lines[i].split(';');
            for (var c = 0; c < cols.length; c++) cols[c] = cols[c].trim();

            var invoiceNumber = cols[COL.INVOICE];
            if (cols.length < MIN_COLUMNS || !invoiceNumber) {
                badLines.push(i + 1);
                continue;
            }

            var g = index[invoiceNumber];
            if (!g) {
                g = {
                    fileName: fileName,
                    invoiceNumber: invoiceNumber,
                    invoiceDateRaw: cols[COL.INVOICE_DATE],
                    vendorIds: [],
                    lines: [],
                    issues: []
                };
                index[invoiceNumber] = g;
                groups.push(g);
            }

            var marker = cols[COL.MARKER];
            var account = cols[COL.ACCOUNT];
            if (marker === '1') {
                if (!/^\d+$/.test(account)) {
                    g.issues.push('invalid vendor code "' + account + '"');
                } else {
                    g.vendorIds.push(account);
                }
            } else if (marker === '0') {
                if (account === CONFIG.IGNORED_ACCOUNT) continue;
                if (!/^\d+$/.test(account)) {
                    g.issues.push('invalid account code "' + account + '"');
                    continue;
                }
                var amount = parseAmount(cols[COL.AMOUNT]);
                if (amount === null) {
                    g.issues.push('invalid amount "' + cols[COL.AMOUNT] + '" for account ' + account);
                    continue;
                }
                g.lines.push({ account: account, amount: amount });
            } else {
                g.issues.push('unknown Debit/Credit marker "' + marker + '"');
            }
        }
        return { groups: groups, badLines: badLines };
    }

    /* ---------- NetSuite lookups (done once, in getInputData) ---------- */

    function eachResult(searchObj, callback) {
        var paged = searchObj.runPaged({ pageSize: 1000 });
        for (var p = 0; p < paged.pageRanges.length; p++) {
            var data = paged.fetch({ index: paged.pageRanges[p].index }).data;
            for (var r = 0; r < data.length; r++) {
                callback(data[r]);
            }
        }
    }

    function findActiveIds(type, ids) {
        var found = {};
        var parts = chunk(ids, 1000);
        for (var i = 0; i < parts.length; i++) {
            eachResult(search.create({
                type: type,
                filters: [['internalid', 'anyof', parts[i]], 'AND', ['isinactive', 'is', 'F']],
                columns: ['internalid']
            }), function (result) {
                found[String(result.id)] = true;
            });
        }
        return found;
    }

    function findExistingBills(items) {
        var existing = {};
        var invoices = [];
        for (var i = 0; i < items.length; i++) invoices.push(items[i].invoiceNumber);
        var parts = chunk(unique(invoices), CONFIG.SEARCH_CHUNK);

        for (var p = 0; p < parts.length; p++) {
            var orGroup = [];
            for (var n = 0; n < parts[p].length; n++) {
                if (n > 0) orGroup.push('OR');
                orGroup.push([CONFIG.INVOICE_COLUMN, 'is', parts[p][n]]);
            }
            eachResult(search.create({
                type: search.Type.VENDOR_BILL,
                filters: [['mainline', 'is', 'F'], 'AND', [CONFIG.FLAG_FIELD, 'is', 'T'], 'AND', orGroup],
                columns: ['entity', CONFIG.INVOICE_COLUMN]
            }), function (result) {
                existing[String(result.getValue({ name: 'entity' })) + '|' + String(result.getValue({ name: CONFIG.INVOICE_COLUMN }))] = true;
            });
        }
        return existing;
    }

    /* ---------- stages ---------- */

    function getInputData() {
        var targetDate = '';
        try {
            targetDate = getTargetDate();
            var connection = connect();
            var entries = connection.list({ path: '.', sort: sftp.Sort.NAME }) || [];

            var files = [];
            for (var e = 0; e < entries.length; e++) {
                if (entries[e].directory) continue;
                var m = CONFIG.FILE_REGEX.exec(entries[e].name);
                if (m && (m[1] + '-' + m[2] + '-' + m[3]) === targetDate) files.push(entries[e]);
            }
            files.sort(function (a, b) {
                return a.name < b.name ? -1 : 1;
            });

            if (!files.length) {
                createErrorRecord('No MyInventory files were found on the SFTP for ' + toDisplayDate(targetDate) + '.');
                return [];
            }

            // 1) Read every file once
            var groups = [];
            var out = [];
            for (var f = 0; f < files.length; f++) {
                var parsed = parseFile(files[f].name, connection.download({ filename: files[f].name }).getContents());
                for (var g = 0; g < parsed.groups.length; g++) groups.push(parsed.groups[g]);
                if (parsed.badLines.length) {
                    out.push(JSON.stringify({
                        error: 'File ' + files[f].name + ': ' + parsed.badLines.length + ' line(s) could not be read and were skipped (line numbers: ' +
                            parsed.badLines.slice(0, 10).join(', ') + (parsed.badLines.length > 10 ? ', ...' : '') + ').'
                    }));
                }
            }

            // 2) Load everything needed from NetSuite in bulk
            var vendorIds = [];
            var accountIds = [];
            for (var i = 0; i < groups.length; i++) {
                vendorIds = vendorIds.concat(groups[i].vendorIds);
                for (var l = 0; l < groups[i].lines.length; l++) accountIds.push(groups[i].lines[l].account);
            }
            var activeVendors = findActiveIds(search.Type.VENDOR, unique(vendorIds));
            var activeAccounts = findActiveIds(search.Type.ACCOUNT, unique(accountIds));

            // 3) Validate every invoice and build the final payloads
            var valid = [];
            for (var k = 0; k < groups.length; k++) {
                var grp = groups[k];
                var issues = grp.issues.slice();
                var vendors = unique(grp.vendorIds);

                if (!vendors.length) {
                    issues.push('no vendor line was found (Debit/Credit Marker 1)');
                } else if (vendors.length > 1) {
                    issues.push('more than one vendor was found (' + vendors.join(', ') + ')');
                } else if (!activeVendors[vendors[0]]) {
                    issues.push('Vendor ID ' + vendors[0] + ' was not found in NetSuite or is inactive');
                }

                if (!grp.lines.length) issues.push('no expense lines were found');
                var checked = {};
                for (var x = 0; x < grp.lines.length; x++) {
                    var acc = grp.lines[x].account;
                    if (checked[acc]) continue;
                    checked[acc] = true;
                    if (!activeAccounts[acc]) issues.push('Account ID ' + acc + ' was not found in NetSuite or is inactive');
                }

                var invoiceDate = parseDate(grp.invoiceDateRaw);
                if (!invoiceDate) issues.push('Invoice Date "' + grp.invoiceDateRaw + '" is not valid');

                if (issues.length) {
                    out.push(JSON.stringify({ error: invoiceLabel(grp.fileName, grp.invoiceNumber) + ' was not posted: ' + issues.join('; ') + '.' }));
                    continue;
                }
                valid.push({
                    fileName: grp.fileName,
                    invoiceNumber: grp.invoiceNumber,
                    vendorId: vendors[0],
                    invoiceDate: invoiceDate,
                    lines: grp.lines
                });
            }

            // 4) Skip invoices that were already posted (or repeated in this run)
            var existing = valid.length ? findExistingBills(valid) : {};
            var seen = {};
            var skipped = 0;
            for (var v = 0; v < valid.length; v++) {
                var key = valid[v].vendorId + '|' + valid[v].invoiceNumber;
                if (existing[key] || seen[key]) {
                    skipped++;
                    log.audit({ title: 'Invoice skipped', details: invoiceLabel(valid[v].fileName, valid[v].invoiceNumber) + ' already exists for vendor ' + valid[v].vendorId });
                    continue;
                }
                seen[key] = true;
                out.push(JSON.stringify(valid[v]));
            }

            log.audit({ title: 'MyInventory data prepared', details: { date: targetDate, files: files.length, invoices: groups.length, toProcess: out.length, skippedExisting: skipped } });
            return out;
        } catch (e) {
            log.error({ title: 'Get Input Error', details: e.name + ': ' + e.message });
            createErrorRecord('MyInventory files could not be read from the SFTP' + (targetDate ? ' for ' + toDisplayDate(targetDate) : '') + '. Details: ' + e.message);
            throw e;
        }
    }

    function friendlySaveError(e) {
        var message = String((e && e.message) || e);
        if (/period/i.test(message) && /(closed|locked)/i.test(message)) return 'the Invoice Date falls in a closed or locked accounting period';
        if (/permission/i.test(message)) return 'the integration user does not have permission to create vendor bills';
        return message;
    }

    function map(context) {
        var p = {};
        try {
            p = JSON.parse(context.value);
            if (p.error) {
                createErrorRecord(p.error);
                context.write({ key: 'failed', value: '1' });
                return;
            }

            var parts = p.invoiceDate.split('-');
            var bill = record.create({ type: record.Type.VENDOR_BILL, isDynamic: true });
            bill.setValue({ fieldId: 'entity', value: p.vendorId });
            bill.setValue({ fieldId: 'tranid', value: p.invoiceNumber });
            bill.setValue({ fieldId: 'trandate', value: new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0) });
            bill.setValue({ fieldId: CONFIG.FLAG_FIELD, value: true });
            bill.setValue({ fieldId: 'approvalstatus', value: CONFIG.APPROVED_STATUS });

            for (var i = 0; i < p.lines.length; i++) {
                bill.selectNewLine({ sublistId: 'expense' });
                bill.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'account', value: p.lines[i].account });
                bill.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'amount', value: p.lines[i].amount });
                bill.setCurrentSublistValue({ sublistId: 'expense', fieldId: CONFIG.INVOICE_COLUMN, value: p.invoiceNumber });
                bill.commitLine({ sublistId: 'expense' });
            }

            var billId = bill.save();
            log.audit({ title: 'Vendor bill created', details: { billId: billId, invoice: p.invoiceNumber, file: p.fileName } });
            context.write({ key: 'created', value: String(billId) });
        } catch (e) {
            log.error({ title: 'Map Error', details: (p.invoiceNumber || '') + ' | ' + e.name + ': ' + e.message });
            createErrorRecord(invoiceLabel(p.fileName || '', p.invoiceNumber || '') + ' was not posted: ' + friendlySaveError(e));
            context.write({ key: 'failed', value: '1' });
        }
    }

    function summarize(summary) {
        var created = 0;
        var failed = 0;
        summary.output.iterator().each(function (key) {
            if (key === 'created') created++;
            else failed++;
            return true;
        });
        if (summary.inputSummary.error) log.error({ title: 'Input stage failed', details: summary.inputSummary.error });
        summary.mapSummary.errors.iterator().each(function (key, error) {
            log.error({ title: 'Map failed: ' + key, details: error });
            return true;
        });
        var result = { created: created, failed: failed, seconds: summary.seconds, usage: summary.usage };
        log.audit({ title: 'MyInventory posting complete', details: result });

        // Share the result with the Suitelet screen.
        try {
            cache.getCache({ name: CONFIG.RESULT_CACHE_NAME, scope: cache.Scope.PUBLIC }).put({
                key: 'date_' + getTargetDate(),
                value: JSON.stringify(result),
                ttl: CONFIG.RESULT_CACHE_TTL
            });
        } catch (e) {
            log.error({ title: 'Could not store the posting result', details: e.name + ': ' + e.message });
        }
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
});