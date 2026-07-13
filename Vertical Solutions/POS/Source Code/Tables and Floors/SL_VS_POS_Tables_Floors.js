/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * @ScriptName SL || POS Tables/Floors
 */
define(['N/file', 'N/search', 'N/log', 'N/record', 'POS/POS_LIB/POS_SessionLib.js'],
    function (file, search, log, record, sessionLib) {

        function onRequest(context) {
            try {
                var guard = sessionLib.requireSession(context);
                if (!guard.allowed) {
                    return;
                }

                var session = guard.session;

                if (context.request.method === 'GET') {
                    context.response.setHeader({ name: 'Content-Type', value: 'text/html; charset=UTF-8' });

                    // Load Tables once (so the HTML page can consume it)
                    var tables = getTables();

                    // Load HTML from File Cabinet (same pattern as your dashboard)
                    var htmlFile = file.load({ id: 'POS/POS_HTML/POS_Tables_Floors.html' });
                    var html = htmlFile.getContents();
                    var cssFile = file.load({ id: 'POS/POS_CSS/POS_Tables_Floors.css' });
                    var cssUrl = cssFile.url;

                    var html = htmlFile.getContents();
                    html = html.replace(
                        '<link rel="stylesheet" href="POS_Tables_Floors.css">',
                        '<link rel="stylesheet" href="' + cssUrl + '">'
                    );
                    // Expose data to the HTML page without hardcoding external links
                    // HTML can read: window.POS_SESSION / window.POS_TABLES
                    html = injectData(html, {
                        POS_SESSION: {
                            employeeId: session.employeeId
                        },
                        POS_TABLES: tables
                    });

                    context.response.write(html);
                    return;
                }

                if (context.request.method === 'POST') {
                    var body = {};
                    try {
                        body = JSON.parse(context.request.body || '{}');
                        log.debug('POST Body', body);
                    } catch (eParse) {
                        log.error('POST JSON parse error', eParse);
                        writeJson(context, { success: false, message: 'Invalid JSON' });
                        return;
                    }

                    if (body.action === 'get_tables') {
                        writeJson(context, { success: true, tables: getTables() });
                        return;
                    }

                    if (body.action === 'create_table') {
                        var result = createTable(body);
                        writeJson(context, result);
                        return;
                    }

                    if (body.action === 'update_table') {
                        var resultUpdate = updateTable(body);
                        writeJson(context, resultUpdate);
                        return;
                    }

                    writeJson(context, { success: false, message: 'Unknown action' });
                    return;
                }

            } catch (e) {
                log.error('Tables/Floors Error', e);
                try {
                    context.response.write('Unable to load Tables/Floors');
                } catch (e2) {
                    log.error('Tables/Floors Response Error', e2);
                }
            }
        }

        function getTables() {
            try {
                var data = [];

                var customrecord_vs_pos_tablesSearchObj = search.create({
                    type: 'customrecord_vs_pos_tables',
                    filters: [
                        ['isinactive', 'is', 'F']
                    ],
                    columns: [
                        search.createColumn({ name: 'internalid', label: 'Internal ID' }),
                        search.createColumn({ name: 'custrecord_vs_postables_table_number', label: 'Table Number' }),
                        search.createColumn({ name: 'custrecord_vs_postables_table_status', label: 'Table Status' }),
                        search.createColumn({ name: 'custrecord_vs_posttables_number_ofchairs', label: 'Number of Chairs' })
                    ]
                });

                customrecord_vs_pos_tablesSearchObj.run().each(function (result) {
                    try {
                        data.push({
                            id: result.getValue({ name: 'internalid' }),
                            tableNumber: result.getValue({ name: 'custrecord_vs_postables_table_number' }),
                            status: result.getText({ name: 'custrecord_vs_postables_table_status' }),
                            chairs: result.getValue({ name: 'custrecord_vs_posttables_number_ofchairs' })
                        });
                    } catch (lineErr) {
                        log.error('getTables line parse error', lineErr);
                    }
                    return true;
                });

                log.debug('getTables', 'Tables loaded: ' + data.length);
                log.debug('Tables Data', data);
                
                return data;
            } catch (e) {
                log.error('getTables error', e);
                return [];
            }
        }

        function injectData(html, objMap) {
            try {
                // Inserts a script tag before </head> if present; otherwise before </body>; otherwise append.
                var script = '<script type="text/javascript">';
                script += 'window.POS_DATA = window.POS_DATA || {};';

                for (var key in objMap) {
                    if (objMap.hasOwnProperty(key)) {
                        script += 'window.POS_DATA["' + escapeJsString(key) + '"] = ' + JSON.stringify(objMap[key]) + ';';
                    }
                }

                script += '</script>';

                if (html.indexOf('</head>') !== -1) {
                    return html.replace('</head>', script + '</head>');
                }
                if (html.indexOf('</body>') !== -1) {
                    return html.replace('</body>', script + '</body>');
                }
                return html + script;
            } catch (e) {
                log.error('injectData error', e);
                return html;
            }
        }

        function escapeJsString(str) {
            try {
                return (str || '').toString().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            } catch (e) {
                return '';
            }
        }

        function writeJson(context, payload) {
            try {
                context.response.setHeader({ name: 'Content-Type', value: 'application/json; charset=UTF-8' });
                context.response.write(JSON.stringify(payload));
            } catch (e) {
                log.error('writeJson error', e);
            }
        }

        function createTable(data) {
            try {
                log.debug('createTable input', data);

                var rec = record.create({ type: 'customrecord_vs_pos_tables', isDynamic: true });

                rec.setValue({ fieldId: 'custrecord_vs_postables_table_number', value: data.tableNumber });
                rec.setValue({ fieldId: 'custrecord_vs_postables_table_status', value: 1 });
                rec.setValue({ fieldId: 'custrecord_vs_posttables_number_ofchairs', value: data.chairs });

                var id = rec.save();
                log.debug('Table created', id);

                return { success: true, id: id };
            } catch (e) {
                log.error('createTable error', e);
                return { success: false, message: e.message };
            }
        }

        function updateTable(data) {
            try {
                log.debug('updateTable input', data);

                var rec = record.load({ type: 'customrecord_vs_pos_tables', id: data.id, isDynamic: true });

                if (data.status) {
                    rec.setValue({ fieldId: 'custrecord_vs_postables_table_status', value: data.status });
                }

                if (data.chairs) {
                    rec.setValue({ fieldId: 'custrecord_vs_posttables_number_ofchairs', value: data.chairs });
                }

                rec.save();
                log.debug('Table updated', data.id);

                return { success: true };
            } catch (e) {
                log.error('updateTable error', e);
                return { success: false, message: e.message };
            }
        }

        return {
            onRequest: onRequest
        };
    });
