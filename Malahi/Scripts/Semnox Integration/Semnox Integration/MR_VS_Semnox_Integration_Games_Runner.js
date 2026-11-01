/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Semnox Integration Games Runner
 */
define(['N/record', 'N/search', 'N/file', 'N/format', 'N/runtime', 'N/log'],
    function (record, search, file, format, runtime, log) {

        // ===================== CONFIG =====================
        var CONFIG = {
            CUSTOM_FORM: 115,
            APPROVAL_STATUS_APPROVED: 2,
            SYSTEM_SEMNOX: 1,
            ALLOWED_GAME_PROFILES: ['time based'],   // lower-case; only Time Based for now
            ERROR_RECORD: 'customrecord_vs_semnox_errors',
            FILE_PREFIX: 'Malahi_Games_Report_',     // + DDMMYY + .csv
            FILE_EXT: '.csv'
        };

        // ===================== HELPERS =====================

        function norm(v) {
            return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
        }

        function clean(v) {
            return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim();
        }

        function round(n, d) {
            var p = Math.pow(10, d);
            return Math.round((n + 1e-9) * p) / p;
        }

        /** Writes a readable message to the Semnox errors custom record. Never throws. */
        function logError(message) {
            try {
                var rec = record.create({ type: CONFIG.ERROR_RECORD });
                rec.setValue({ fieldId: 'custrecord_vs_date_time_created', value: new Date() });
                rec.setValue({ fieldId: 'custrecord_vs_error', value: String(message).substring(0, 3900) });
                rec.save();
            } catch (e) {
                log.error('Could not write to Semnox errors record', e.message + ' | ' + message);
            }
        }

        /** Parses a CSV text into an array of arrays (handles quotes). */
        function parseCsv(text) {
            if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
            var rows = [], row = [], cur = '', inQ = false, i, ch;
            for (i = 0; i < text.length; i++) {
                ch = text.charAt(i);
                if (inQ) {
                    if (ch === '"') {
                        if (text.charAt(i + 1) === '"') { cur += '"'; i++; }
                        else inQ = false;
                    } else cur += ch;
                } else if (ch === '"') {
                    inQ = true;
                } else if (ch === ',') {
                    row.push(cur); cur = '';
                } else if (ch === '\n' || ch === '\r') {
                    if (ch === '\r' && text.charAt(i + 1) === '\n') i++;
                    row.push(cur); cur = '';
                    if (row.length > 1 || row[0] !== '') rows.push(row);
                    row = [];
                } else cur += ch;
            }
            if (cur !== '' || row.length) {
                row.push(cur);
                if (row.length > 1 || row[0] !== '') rows.push(row);
            }
            return rows;
        }

        /** Finds the CSV in the File Cabinet by name: Malahi_Games_Report_DDMMYY.csv */
        function getCsvFile(reportDateParam) {
            var d = format.parse({ value: reportDateParam, type: format.Type.DATE });
            var dd = ('0' + d.getDate()).slice(-2);
            var mm = ('0' + (d.getMonth() + 1)).slice(-2);
            var yy = String(d.getFullYear()).slice(-2);
            var fileName = CONFIG.FILE_PREFIX + dd + mm + yy + CONFIG.FILE_EXT;

            var fileId = null;
            search.create({
                type: 'file',
                filters: [['name', 'is', fileName]],
                columns: ['internalid']
            }).run().each(function (r) {
                fileId = r.id;
                return false;
            });

            if (!fileId) {
                throw new Error('The games report file "' + fileName + '" was not found in the File Cabinet. ' +
                    'Please upload it and run the integration again.');
            }
            return { file: file.load({ id: fileId }), name: fileName };
        }

        /** Generic lookup: returns { lowercaseName: internalId } for the given names. */
        function lookupByNames(searchType, nameFields, names, extraFilters) {
            var map = {};
            if (!names.length) return map;

            var CHUNK = 20, i, j, k;
            for (i = 0; i < names.length; i += CHUNK) {
                var slice = names.slice(i, i + CHUNK);
                var nameExpr = [];
                for (j = 0; j < slice.length; j++) {
                    for (k = 0; k < nameFields.length; k++) {
                        if (nameExpr.length) nameExpr.push('OR');
                        nameExpr.push([nameFields[k], 'is', slice[j]]);
                    }
                }
                var filters = [nameExpr];
                if (extraFilters) filters = filters.concat(['AND'], extraFilters);

                var columns = nameFields.map(function (f) { return search.createColumn({ name: f }); });

                var paged = search.create({ type: searchType, filters: filters, columns: columns })
                    .runPaged({ pageSize: 1000 });

                paged.pageRanges.forEach(function (pr) {
                    paged.fetch({ index: pr.index }).data.forEach(function (r) {
                        for (var f = 0; f < nameFields.length; f++) {
                            var v = r.getValue(nameFields[f]);
                            if (v && !map[norm(v)]) map[norm(v)] = r.id;
                        }
                    });
                });
            }
            return map;
        }

        // ===================== STAGES =====================

        function getInputData() {
            var script = runtime.getCurrentScript();
            var reportDate = script.getParameter({ name: 'custscript_vs_report_date2' });

            try {
                if (!reportDate) {
                    throw new Error('No report date was provided. Please select a date and run the integration again.');
                }

                // ---- 1. Read the CSV ----
                var csv = getCsvFile(reportDate);
                var rows = parseCsv(csv.file.getContents());
                if (rows.length < 2) {
                    throw new Error('The file "' + csv.name + '" is empty or has no data rows.');
                }

                var header = rows[0].map(function (h) { return norm(h); });
                var idx = {
                    date: header.indexOf('date'),
                    pm: header.indexOf('payment method'),
                    profile: header.indexOf('game profile'),
                    game: header.indexOf('game name'),
                    qty: header.indexOf('credit play count'),
                    amt: header.indexOf('total play(amount)'),
                    loc: header.indexOf('location')
                };
                Object.keys(idx).forEach(function (k) {
                    if (idx[k] === -1) {
                        throw new Error('The file "' + csv.name + '" is missing the column "' + k +
                            '". Please check that the report layout was not changed.');
                    }
                });

                // ---- 2. Filter + group ----
                var groups = {};
                var pmNames = {}, locNames = {}, profileNames = {};
                var skippedZero = 0, skippedProfile = 0;

                for (var i = 1; i < rows.length; i++) {
                    var r = rows[i];
                    var qty = parseFloat(r[idx.qty]);
                    var amt = parseFloat(r[idx.amt]);

                    if (!qty || isNaN(qty)) { skippedZero++; continue; }          // remove 0 Credit Play Count
                    if (isNaN(amt)) amt = 0;

                    var profile = clean(r[idx.profile]);
                    if (CONFIG.ALLOWED_GAME_PROFILES.indexOf(norm(profile)) === -1) { skippedProfile++; continue; } // Remove this line to use all items in the report

                    var pm = clean(r[idx.pm]);
                    var loc = clean(r[idx.loc]);
                    var dateStr = clean(r[idx.date]);
                    var gameName = clean(r[idx.game]);

                    if (!pm || !loc || !dateStr) {
                        logError('Row ' + (i + 1) + ' in "' + csv.name + '" was skipped because the Payment Method, ' +
                            'Location or Date is empty.');
                        continue;
                    }

                    // One file = one day, so group by payment method + location only.
                    // The invoice date is taken from the first row of each group.
                    var gKey = norm(pm) + '|' + norm(loc);
                    if (!groups[gKey]) {
                        groups[gKey] = { paymentMethod: pm, location: loc, date: dateStr, lines: {} };
                    }
                    var lKey = norm(profile) + '|' + norm(gameName);
                    var line = groups[gKey].lines[lKey];
                    if (!line) {
                        line = groups[gKey].lines[lKey] = { profile: profile, gameName: gameName, qty: 0, amount: 0 };
                    }
                    line.qty += qty;
                    line.amount += amt;

                    pmNames[norm(pm)] = pm;
                    locNames[norm(loc)] = loc;
                    profileNames[norm(profile)] = profile;
                }

                log.audit('CSV read', {
                    file: csv.name,
                    totalRows: rows.length - 1,
                    skippedZeroQty: skippedZero,
                    skippedOtherProfiles: skippedProfile,
                    invoicesToCreate: Object.keys(groups).length
                });

                // ---- 3. Resolve internal ids once ----
                var customerMap = lookupByNames('customer', ['entityid', 'companyname'],
                    Object.keys(pmNames).map(function (k) { return pmNames[k]; }));
                var locationMap = lookupByNames('location', ['name'],
                    Object.keys(locNames).map(function (k) { return locNames[k]; }));
                var itemMap = lookupByNames('item', ['itemid'],
                    Object.keys(profileNames).map(function (k) { return profileNames[k]; }),
                    [['type', 'anyof', ['Service']]]);

                // ---- 4. Report missing master data once per name, skip affected groups ----
                var reported = {};
                function reportOnce(kind, name, text) {
                    var k = kind + '|' + norm(name);
                    if (!reported[k]) { reported[k] = true; logError(text); }
                }

                var output = [];
                Object.keys(groups).forEach(function (gKey) {
                    var g = groups[gKey];
                    var customerId = customerMap[norm(g.paymentMethod)];
                    var locationId = locationMap[norm(g.location)];
                    var ok = true;

                    if (!customerId) {
                        ok = false;
                        reportOnce('c', g.paymentMethod, 'The customer "' + g.paymentMethod + '" (Payment Method) was not found in NetSuite. ' +
                            'Invoices for this payment method were not created. Please create the customer with this exact name and run again.');
                    }
                    if (!locationId) {
                        ok = false;
                        reportOnce('l', g.location, 'The location "' + g.location + '" was not found in NetSuite. ' +
                            'Invoices for this location were not created. Please create the location with this exact name and run again.');
                    }

                    var lines = [];
                    Object.keys(g.lines).forEach(function (lk) {
                        var l = g.lines[lk];
                        var itemId = itemMap[norm(l.profile)];
                        if (!itemId) {
                            ok = false;
                            reportOnce('i', l.profile, 'The service item "' + l.profile + '" (Game Profile) was not found in NetSuite. ' +
                                'Invoices that use this item were not created. Please create a Service item with this exact name and run again.');
                            return;
                        }
                        var qty = round(l.qty, 4);
                        var amount = round(l.amount, 2);
                        lines.push({
                            itemId: itemId,
                            description: l.gameName,
                            quantity: qty,
                            amount: amount,
                            rate: qty ? round(amount / qty, 4) : 0
                        });
                    });

                    if (ok && lines.length) {
                        output.push({
                            key: gKey,
                            value: {
                                paymentMethod: g.paymentMethod,
                                location: g.location,
                                date: g.date,
                                customerId: customerId,
                                locationId: locationId,
                                lines: lines
                            }
                        });
                    }
                });

                return output;

            } catch (e) {
                log.error('getInputData error', e);
                logError(e.message);
                return [];
            }
        }

        function map(context) {
            var data = JSON.parse(context.value);
            var label = 'payment method "' + data.paymentMethod + '" at location "' + data.location +
                '" on ' + data.date;

            try {
                // DD/MM/YYYY from the CSV -> Date (noon avoids timezone day shifts)
                var p = data.date.split('/');
                var tranDate = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10), 12, 0, 0);
                if (isNaN(tranDate.getTime())) {
                    throw new Error('The date "' + data.date + '" is not in the expected DD/MM/YYYY format.');
                }

                // Protect against double billing if the integration is run twice for the same day
                var existing = null;
                search.create({
                    type: 'invoice',
                    filters: [
                        ['mainline', 'is', 'T'], 'AND',
                        ['entity', 'anyof', data.customerId], 'AND',
                        ['location', 'anyof', data.locationId], 'AND',
                        ['trandate', 'on', format.format({ value: tranDate, type: format.Type.DATE })], 'AND',
                        ['custbody_vs_semnox_transaction', 'is', 'T']
                    ],
                    columns: ['tranid']
                }).run().each(function (r) { existing = r.getValue('tranid') || r.id; return false; });

                if (existing) {
                    logError('An invoice already exists for ' + label + ' (invoice ' + existing + '). ' +
                        'A new invoice was not created to avoid duplicates. Delete the existing invoice first if you want to re-run.');
                    return;
                }

                var inv = record.create({
                    type: record.Type.INVOICE,
                    isDynamic: false,
                    defaultValues: { customform: CONFIG.CUSTOM_FORM }
                });

                inv.setValue({ fieldId: 'customform', value: CONFIG.CUSTOM_FORM });
                inv.setValue({ fieldId: 'entity', value: data.customerId });
                inv.setValue({ fieldId: 'trandate', value: tranDate });
                inv.setValue({ fieldId: 'location', value: data.locationId });
                inv.setValue({ fieldId: 'approvalstatus', value: CONFIG.APPROVAL_STATUS_APPROVED });
                inv.setValue({ fieldId: 'custbody_vs_semnox_transaction', value: true });
                inv.setValue({ fieldId: 'custbodyvs_system', value: CONFIG.SYSTEM_SEMNOX });

                data.lines.forEach(function (l, i) {
                    inv.setSublistValue({ sublistId: 'item', fieldId: 'item', line: i, value: l.itemId });
                    inv.setSublistValue({ sublistId: 'item', fieldId: 'description', line: i, value: l.description });
                    inv.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i, value: l.quantity });
                    inv.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: i, value: l.rate });
                    inv.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: i, value: l.amount });
                });

                var invId = inv.save({ enableSourcing: true, ignoreMandatoryFields: false });

                log.audit('Invoice created', { id: invId, customer: data.paymentMethod, location: data.location, lines: data.lines.length });

            } catch (e) {
                log.error('Invoice failed: ' + label, e);
                logError('The invoice for ' + label + ' could not be created. Reason: ' + (e.message || e));
            }
        }

        function summarize(summary) {
            if (summary.inputSummary.error) {
                logError('The integration could not read its input data. Reason: ' + summary.inputSummary.error);
            }
            summary.mapSummary.errors.iterator().each(function (key, err) {
                logError('An unexpected error stopped one invoice (' + key + '). Reason: ' + JSON.parse(err).message);
                return true;
            });
            log.audit('Games integration finished', {
                seconds: summary.seconds,
                usage: summary.usage,
                yields: summary.yields
            });
        }

        return {
            getInputData: getInputData,
            map: map,
            summarize: summarize
        };
    });