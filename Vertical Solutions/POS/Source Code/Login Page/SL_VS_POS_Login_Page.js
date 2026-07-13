/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @ScriptName SL || POS Login Page
 */
define(['N/search', 'N/file', 'N/record', 'N/log', 'N/crypto', 'N/url', 'N/runtime'],
    function (search, file, record, log, crypto, url, runtime) {

        function onRequest(context) {
            try {

                if (context.request.method === 'GET') {

                    var htmlFile = file.load({ id: 'POS/POS_HTML/POS_Login_Page.html' });
                    var cssFile = file.load({ id: 'POS/POS_CSS/POS_Login_Page.css' });
                    var cssUrl = cssFile.url;

                    var html = htmlFile.getContents();
                    html = html.replace(
                        '<link rel="stylesheet" href="POS_Login_Page.css">',
                        '<link rel="stylesheet" href="' + cssUrl + '">'
                    );
                    context.response.write(html);
                    return;
                }

                if (context.request.method === 'POST') {

                    var body = JSON.parse(context.request.body || '{}');
                    var action = body.action || 'login';

                    /* =====================================================
                       ACTION: GET LOGIN CONFIG (Dynamic URLs)
                       ===================================================== */
                    if (action === 'get_login_config') {

                        var loginUrl = url.resolveScript({
                            scriptId: 'customscript_vs_sl_pos_login_page',
                            deploymentId: 'customdeploy_vs_sl_pos_login_page',
                            returnExternalUrl: true
                        });

                        var dashboardSuiteletUrl = url.resolveScript({
                            scriptId: 'customscript_vs_sl_pos_dashboard',
                            deploymentId: 'customdeploy_vs_sl_pos_dashboard',
                            returnExternalUrl: true
                        });

                        context.response.write(JSON.stringify({
                            success: true,
                            loginUrl: loginUrl,
                            dashboardSuiteletUrl: dashboardSuiteletUrl
                        }));
                        return;
                    }

                    /* =====================================================
                       ACTION: LOGOUT
                       ===================================================== */
                    if (action === 'logout') {
                        var tokenToLogout = getCookieValueFromRequest(context, 'POSSESS');
                        if (tokenToLogout) {
                            invalidateSessionByToken(tokenToLogout);
                        }

                        clearSessionCookie(context);

                        context.response.write(JSON.stringify({ success: true, message: 'Logged out' }));
                        return;
                    }

                    /* =====================================================
                       ACTION: LOGIN (DEFAULT)
                       ===================================================== */
                    var username = body.username;
                    var password = body.password;

                    log.debug('POS Login', { username: username, passwordLength: password ? password.length : 0 });

                    if (!username || !password) {
                        context.response.write(JSON.stringify({ success: false, message: 'Username and password are required' }));
                        return;
                    }

                    /* ===============================
                       STEP 1: CHECK USERNAME
                       =============================== */
                    var usernameSearch = search.create({
                        type: 'customrecord_vs_pos_users',
                        filters: [
                            ['isinactive', 'is', 'F'],
                            'AND',
                            ['custrecord_vs_posusers_username', 'is', username]
                        ],
                        columns: [
                            'internalid',
                            'custrecord_vs_posusers_employee'
                        ]
                    });

                    var usernameResult = usernameSearch.run().getRange({ start: 0, end: 1 });

                    log.debug('POS Login', 'Username search count: ' + (usernameResult ? usernameResult.length : 0));

                    if (!usernameResult || usernameResult.length === 0) {
                        context.response.write(JSON.stringify({
                            success: false,
                            message: 'Username is incorrect'
                        }));
                        return;
                    }

                    /* ===============================
                       STEP 2: CHECK PASSWORD
                       =============================== */
                    var userId = parseInt(usernameResult[0].getValue({ name: 'internalid' }), 10);

                    var isValidPassword = crypto.checkPasswordField({
                        recordType: 'customrecord_vs_pos_users',
                        recordId: userId,
                        fieldId: 'custrecord_vs_posusers_password',
                        value: password
                    });

                    log.debug('POS Login', { userId: userId, passwordValid: isValidPassword });

                    if (!isValidPassword) {
                        context.response.write(JSON.stringify({ success: false, message: 'Password is incorrect' }));
                        return;
                    }

                    /* ===============================
                       LOGIN SUCCESS → CREATE SESSION + SET COOKIE
                       =============================== */
                    var employeeId = usernameResult[0].getValue({ name: 'custrecord_vs_posusers_employee' });

                    var sessionCreateResult = createOrUpdateSessionRecord({
                        employeeId: employeeId,
                        ip: context.request.clientIpAddress || '',
                        deviceId: body.deviceId || '',
                        minutesToLive: 240
                    });

                    if (!sessionCreateResult.success) {
                        context.response.write(JSON.stringify({ success: false, message: sessionCreateResult.message || 'Session creation failed' }));
                        return;
                    }

                    setSessionCookie(context, sessionCreateResult.token, sessionCreateResult.minutesToLive);

                    context.response.write(JSON.stringify({
                        success: true,
                        message: 'Login successful',
                        employeeId: employeeId
                    }));
                    return;
                }

            } catch (e) {
                log.error('POS Login Error', e);
                logError(e, e.message);

                context.response.write(JSON.stringify({ success: false, message: 'Unexpected error occurred. Please contact administrator.' }));
            }
        }

        /* =====================================================
           SESSION HELPERS (COOKIE + RECORD)
           ===================================================== */

        function generateToken() {
            try {
                var raw = runtime.accountId + ':' + new Date().getTime() + ':' + Math.floor(Math.random() * 1000000000);
                var hash = crypto.createHash({ algorithm: crypto.HashAlg.SHA256 });
                hash.update({ input: raw });
                return hash.digest({ outputEncoding: crypto.Encoding.HEX });
            } catch (e) {
                log.error('generateToken error', e);
                return String(new Date().getTime()) + String(Math.floor(Math.random() * 1000000000));
            }
        }

        function addMinutes(dateObj, minutes) {
            return new Date(dateObj.getTime() + (minutes * 60 * 1000));
        }

        function setSessionCookie(context, token, minutesToLive) {
            try {
                var maxAge = minutesToLive * 60;

                var cookie = 'POSSESS=' + encodeURIComponent(token)
                    + '; Path=/'
                    + '; Max-Age=' + maxAge
                    + '; HttpOnly'
                    + '; SameSite=Lax'
                    + '; Secure';

                context.response.setHeader({ name: 'Set-Cookie', value: cookie });

                log.debug('POS Login', 'Session cookie set');
            } catch (e) {
                log.error('setSessionCookie error', e);
            }
        }

        function clearSessionCookie(context) {
            try {
                var cookie = 'POSSESS=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure';
                context.response.setHeader({ name: 'Set-Cookie', value: cookie });
            } catch (e) {
                log.error('clearSessionCookie error', e);
            }
        }

        function getCookieValue(cookieHeader, cookieName) {
            try {
                if (!cookieHeader) return '';
                var parts = cookieHeader.split(';');
                var i;
                for (i = 0; i < parts.length; i++) {
                    var p = (parts[i] || '').trim();
                    if (p.indexOf(cookieName + '=') === 0) {
                        return decodeURIComponent(p.substring((cookieName + '=').length));
                    }
                }
                return '';
            } catch (e) {
                log.error('getCookieValue error', e);
                return '';
            }
        }

        function getCookieValueFromRequest(context, cookieName) {
            try {
                var cookieHeader = context.request.headers.cookie || context.request.headers.Cookie || '';
                return getCookieValue(cookieHeader, cookieName);
            } catch (e) {
                log.error('getCookieValueFromRequest error', e);
                return '';
            }
        }

        function createOrUpdateSessionRecord(options) {
            try {
                if (!options || !options.employeeId) {
                    return { success: false, message: 'Missing employeeId' };
                }

                var employeeId = options.employeeId;
                var token = generateToken();
                var now = new Date();
                var minutesToLive = options.minutesToLive || 240;
                var expires = addMinutes(now, minutesToLive);

                // 1) Find existing session for employee
                var sessionSearch = search.create({
                    type: 'customrecord_vs_pos_session_manager',
                    filters: [
                        ['isinactive', 'is', 'F'],
                        'AND',
                        ['custrecord_vs_pos_employee', 'anyof', employeeId]
                    ],
                    columns: ['internalid']
                });

                var res = sessionSearch.run().getRange({ start: 0, end: 1 });
                var sessionId = (res && res.length) ? res[0].getValue({ name: 'internalid' }) : null;

                // 2) Update existing OR create new
                if (sessionId) {
                    var valuesToUpdate = {
                        custrecord_vs_pos_session_token: token,
                        custrecord_vs_pos_session_created: now,
                        custrecord_vs_pos_session_expires: expires,
                        custrecord_vs_pos_session_status: 'ACTIVE'
                    };

                    if (options.ip) {
                        valuesToUpdate.custrecord_vs_pos_session_ip = options.ip;
                    }
                    if (options.deviceId) {
                        valuesToUpdate.custrecord_vs_pos_session_device_id = options.deviceId;
                    }

                    record.submitFields({
                        type: 'customrecord_vs_pos_session_manager',
                        id: sessionId,
                        values: valuesToUpdate,
                        options: { enableSourcing: false, ignoreMandatoryFields: true }
                    });

                    log.debug('POS Login Session', {
                        action: 'UPDATED',
                        sessionId: sessionId,
                        employeeId: employeeId,
                        expires: expires
                    });
                } else {
                    var sessionRec = record.create({
                        type: 'customrecord_vs_pos_session_manager',
                        isDynamic: true
                    });

                    sessionRec.setValue({ fieldId: 'custrecord_vs_pos_employee', value: employeeId });
                    sessionRec.setValue({ fieldId: 'custrecord_vs_pos_session_token', value: token });
                    sessionRec.setValue({ fieldId: 'custrecord_vs_pos_session_created', value: now });
                    sessionRec.setValue({ fieldId: 'custrecord_vs_pos_session_expires', value: expires });
                    sessionRec.setValue({ fieldId: 'custrecord_vs_pos_session_status', value: 'ACTIVE' });

                    if (options.ip) {
                        sessionRec.setValue({ fieldId: 'custrecord_vs_pos_session_ip', value: options.ip });
                    }
                    if (options.deviceId) {
                        sessionRec.setValue({ fieldId: 'custrecord_vs_pos_session_device_id', value: options.deviceId });
                    }

                    sessionId = sessionRec.save();

                    log.debug('POS Login Session', {
                        action: 'CREATED',
                        sessionId: sessionId,
                        employeeId: employeeId,
                        expires: expires
                    });
                }

                return {
                    success: true,
                    token: token,
                    sessionId: sessionId,
                    minutesToLive: minutesToLive
                };

            } catch (e) {
                log.error('createOrUpdateSessionRecord error', e);
                return { success: false, message: 'Unable to create/update session' };
            }
        }

        function invalidateSessionByToken(token) {
            try {
                if (!token) return;

                var sessionSearch = search.create({
                    type: 'customrecord_vs_pos_session_manager',
                    filters: [
                        ['isinactive', 'is', 'F'],
                        'AND',
                        ['custrecord_vs_pos_session_token', 'is', token]
                    ],
                    columns: ['internalid']
                });

                var res = sessionSearch.run().getRange({ start: 0, end: 1 });
                if (!res || res.length === 0) {
                    log.debug('invalidateSessionByToken', 'No session found for token');
                    return;
                }

                var sessionId = res[0].getValue({ name: 'internalid' });

                record.submitFields({
                    type: 'customrecord_vs_pos_session_manager',
                    id: sessionId,
                    values: {
                        custrecord_vs_pos_session_status: 'LOGOUT'
                    },
                    options: { enableSourcing: false, ignoreMandatoryFields: true }
                });

                log.debug('invalidateSessionByToken', { sessionId: sessionId });

            } catch (e) {
                log.error('invalidateSessionByToken error', e);
            }
        }

        /* =====================================================
           ERROR LOGGING (YOUR EXISTING FUNCTION)
           ===================================================== */

        function logError(errorObj, message) {
            try {
                var errRec = record.create({ type: 'customrecord_vs_pos_error_log', isDynamic: true });

                errRec.setValue({ fieldId: 'custrecord_vs_poserrorlog_error', value: errorObj.name || 'POS_LOGIN_ERROR' });
                errRec.setValue({ fieldId: 'custrecord_vs_poserrorlog_error_message', value: message || errorObj.message });

                errRec.save();
            } catch (e) {
                log.error('Error while logging POS error', e);
            }
        }

        return {
            onRequest: onRequest
        };
    });
