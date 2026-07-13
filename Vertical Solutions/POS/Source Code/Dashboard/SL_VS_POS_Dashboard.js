/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * @ScriptName SL || POS Dashboard
 */
define(['N/file', 'N/url', 'N/log', 'POS/POS_LIB/POS_SessionLib.js'],
    function (file, url, log, sessionLib) {

        function onRequest(context) {
            try {
                var guard = sessionLib.requireSession(context);
                if (!guard.allowed) return;

                var session = guard.session;

                if (context.request.method === 'GET') {
                    context.response.setHeader({ name: 'Content-Type', value: 'text/html; charset=UTF-8' });

                    var htmlFile = file.load({ id: 'POS/POS_HTML/POS_Dashboard.html' });
                    var cssFile = file.load({ id: 'POS/POS_CSS/POS_Dashboard.css' });
                    var cssUrl = cssFile.url;

                    var html = htmlFile.getContents();
                    html = html.replace(
                        '<link rel="stylesheet" href="POS_Dashboard.css">',
                        '<link rel="stylesheet" href="' + cssUrl + '">'
                    );
                    context.response.write(html);
                    return;
                }

                if (context.request.method === 'POST') {
                    var body = JSON.parse(context.request.body || '{}');

                    if (body.action === 'get_navigation_urls') {

                        log.debug('Dashboard', 'Resolving navigation URLs');

                        var orderUrl = url.resolveScript({
                            scriptId: 'customscript_vs_sl_pos_order_creation',
                            deploymentId: 'customdeploy_vs_sl_pos_order_creation',
                            returnExternalUrl: true
                        });

                        var tablesUrl = url.resolveScript({
                            scriptId: 'customscript_vs_sl_pos_tables_floors',
                            deploymentId: 'customdeploy_vs_sl_pos_tablesfloors',
                            returnExternalUrl: true
                        });

                        context.response.setHeader({name: 'Content-Type',value: 'application/json'});

                        context.response.write(JSON.stringify({
                            success: true,
                            orderUrl: orderUrl,
                            tablesUrl: tablesUrl,
                            loginUrl: sessionLib.getLoginUrl(),
                            employeeId: session.employeeId
                        }));

                        return;

                    }

                    context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
                    context.response.write(JSON.stringify({ success: false, message: 'Invalid action' }));
                    return;
                }

            } catch (e) {
                log.error('Dashboard Error', e);
                context.response.write('Unable to load dashboard');
            }
        }

        return { onRequest: onRequest };
    });
