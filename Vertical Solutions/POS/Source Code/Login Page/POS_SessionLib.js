/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(['N/search', 'N/log', 'N/url', 'N/format'], function (search, log, url, format) {

    var COOKIE_NAME = 'POSSESS';
    var SESSION_RECORD = 'customrecord_vs_pos_session_manager';

    function getCookieValue(cookieHeader, cookieName) {
        try {
            if (!cookieHeader) return '';
            var parts = String(cookieHeader).split(';');
            var i;
            for (i = 0; i < parts.length; i++) {
                var p = (parts[i] || '').trim();
                if (p.indexOf(cookieName + '=') === 0) {
                    return decodeURIComponent(p.substring((cookieName + '=').length));
                }
            }
            return '';
        } catch (e) {
            log.error('POS_SessionLib.getCookieValue error', e);
            return '';
        }
    }

    function getTokenFromRequest(context) {
        try {
            var headers = context && context.request && context.request.headers ? context.request.headers : {};
            var cookieHeader = headers.cookie || headers.Cookie || '';
            return getCookieValue(cookieHeader, COOKIE_NAME);
        } catch (e) {
            log.error('POS_SessionLib.getTokenFromRequest error', e);
            return '';
        }
    }

    function parseNetSuiteDate(value) {
        try {
            if (!value) return null;

            // Sometimes NetSuite returns a Date object already
            if (Object.prototype.toString.call(value) === '[object Date]') {
                return value;
            }

            // Otherwise parse using N/format (safer than new Date(string))
            return format.parse({
                value: value,
                type: format.Type.DATETIMETZ
            });
        } catch (e) {
            // fallback attempt
            try {
                return new Date(value);
            } catch (e2) {
                log.error('POS_SessionLib.parseNetSuiteDate error', e);
                return null;
            }
        }
    }

    function validateSession(context) {
        try {
            var token = getTokenFromRequest(context);

            log.debug('POS_SessionLib.validateSession', { hasToken: !!token });

            if (!token) {
                return { valid: false, reason: 'NO_TOKEN' };
            }

            var sessionSearch = search.create({
                type: SESSION_RECORD,
                filters: [
                    ['isinactive', 'is', 'F'],
                    'AND',
                    ['custrecord_vs_pos_session_status', 'is', 'ACTIVE'],
                    'AND',
                    ['custrecord_vs_pos_session_token', 'is', token]
                ],
                columns: [
                    'internalid',
                    'custrecord_vs_pos_employee',
                    'custrecord_vs_pos_session_expires'
                ]
            });

            var res = sessionSearch.run().getRange({ start: 0, end: 1 });

            if (!res || res.length === 0) {
                return { valid: false, reason: 'INVALID_TOKEN' };
            }

            var expiresVal = res[0].getValue({ name: 'custrecord_vs_pos_session_expires' });
            var expiresDate = parseNetSuiteDate(expiresVal);

            if (!expiresDate) {
                return { valid: false, reason: 'BAD_EXPIRES_VALUE' };
            }

            var now = new Date();
            if (expiresDate.getTime() <= now.getTime()) {
                return { valid: false, reason: 'EXPIRED' };
            }

            return {
                valid: true,
                token: token,
                sessionId: res[0].getValue({ name: 'internalid' }),
                employeeId: res[0].getValue({ name: 'custrecord_vs_pos_employee' }),
                expires: expiresDate
            };

        } catch (e) {
            log.error('POS_SessionLib.validateSession error', e);
            return { valid: false, reason: 'ERROR' };
        }
    }

    function redirectTo(targetUrl, context) {
        try {
            var safeUrl = String(targetUrl || '').replace(/"/g, '&quot;');
            var html = ''
                + '<html><head>'
                + '<meta http-equiv="refresh" content="0; url=' + safeUrl + '"/>'
                + '</head><body></body></html>';

            context.response.write(html);
        } catch (e) {
            log.error('POS_SessionLib.redirectTo error', e);
            context.response.write('Unauthorized');
        }
    }

    function getLoginUrl() {
        try {
            return url.resolveScript({
                scriptId: 'customscript_vs_sl_pos_login_page',
                deploymentId: 'customdeploy_vs_sl_pos_login_page',
                returnExternalUrl: true
            });
        } catch (e) {
            log.error('POS_SessionLib.getLoginUrl error', e);
            return '';
        }
    }

    /**
     * Standard guard for all POS Suitelets:
     * - If unauthorized + GET: redirect to login
     * - If unauthorized + POST: JSON response with redirectUrl
     * Returns: { allowed: boolean, session: object }
     */
    function requireSession(context) {
        try {
            var session = validateSession(context);

            if (session.valid) {
                return { allowed: true, session: session };
            }

            var loginUrl = getLoginUrl();

            log.debug('POS_SessionLib.requireSession unauthorized', {
                reason: session.reason,
                method: context.request.method
            });

            if (context.request.method === 'GET') {
                redirectTo(loginUrl, context);
                return { allowed: false, session: session };
            }

            context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
            context.response.write(JSON.stringify({
                success: false,
                message: 'Unauthorized',
                reason: session.reason,
                redirectUrl: loginUrl
            }));
            return { allowed: false, session: session };

        } catch (e) {
            log.error('POS_SessionLib.requireSession error', e);
            // safest: block access
            try {
                context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
                context.response.write(JSON.stringify({
                    success: false,
                    message: 'Unauthorized',
                    reason: 'ERROR'
                }));
            } catch (e2) {}
            return { allowed: false, session: { valid: false, reason: 'ERROR' } };
        }
    }

    return {
        validateSession: validateSession,
        requireSession: requireSession,
        getTokenFromRequest: getTokenFromRequest,
        getLoginUrl: getLoginUrl
    };
});
