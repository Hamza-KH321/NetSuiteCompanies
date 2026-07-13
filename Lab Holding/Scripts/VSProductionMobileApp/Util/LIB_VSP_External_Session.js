/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @Filename LIB_VSP_External_Session.js
 */

define(['N/search', 'N/record', 'N/format', 'N/log'], function (search, record, format, log) {
    var SESSION_RECORD = 'customrecord_vs_production_external_sess';
    var FIELD_SESSION_USER = 'custrecord_vs_user';
    var FIELD_SESSION_TOKEN = 'custrecord_vs_session_token';
    var FIELD_SESSION_IP = 'custrecord_vs_session_ip';
    var FIELD_SESSION_START = 'custrecord_vs_session_start';
    var FIELD_SESSION_END = 'custrecord_vs_session_end';
    var FIELD_SESSION_ACTIVE = 'custrecord_vs_session_active';
    var COOKIE_NAME = 'vsp_ext_token';

    function getCookie(context, name) {
        var cookieHeader = context.request.headers.cookie;
        if (!cookieHeader) return '';

        var cookies = cookieHeader.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var parts = cookies[i].trim().split('=');
            if (parts[0] === name) {
                return decodeURIComponent(parts.slice(1).join('='));
            }
        }

        return '';
    }

    function getSessionToken(context) {
        return getCookie(context, COOKIE_NAME);
    }

    function validateSession(token) {
        if (!token) return null;

        var result = search.create({
            type: SESSION_RECORD,
            filters: [
                [FIELD_SESSION_TOKEN, 'is', token],
                'AND',
                [FIELD_SESSION_ACTIVE, 'is', 'T']
            ],
            columns: ['internalid', FIELD_SESSION_USER, FIELD_SESSION_END]
        }).run().getRange({ start: 0, end: 1 });

        if (!result || !result.length) return null;

        var endDateString = result[0].getValue({ name: FIELD_SESSION_END });
        var endDate = format.parse({
            value: endDateString,
            type: format.Type.DATETIME
        });

        if (endDate < new Date()) {
            deactivateSession(result[0].getValue({ name: 'internalid' }));
            return null;
        }

        return {
            sessionId: result[0].getValue({ name: 'internalid' }),
            userId: result[0].getValue({ name: FIELD_SESSION_USER })
        };
    }

    function createOrUpdateSession(userId, clientIp, hoursToLive) {
        var token = generateToken(userId);
        var now = new Date();
        var endDate = new Date(now.getTime() + ((hoursToLive || 8) * 60 * 60 * 1000));
        var existing = search.create({
            type: SESSION_RECORD,
            filters: [[FIELD_SESSION_USER, 'anyof', userId]],
            columns: [search.createColumn({ name: 'internalid', sort: search.Sort.DESC })]
        }).run().getRange({ start: 0, end: 1000 });

        if (existing && existing.length) {
            var sessionId = existing[0].getValue({ name: 'internalid' });
            record.submitFields({
                type: SESSION_RECORD,
                id: sessionId,
                values: buildSessionValues(userId, token, clientIp, now, endDate, true)
            });
            deactivateDuplicateSessions(existing, sessionId);
        } else {
            var sessionRec = record.create({
                type: SESSION_RECORD,
                isDynamic: true
            });
            var values = buildSessionValues(userId, token, clientIp, now, endDate, true);
            Object.keys(values).forEach(function (fieldId) {
                sessionRec.setValue({ fieldId: fieldId, value: values[fieldId] });
            });
            sessionRec.save();
        }

        return token;
    }

    function deactivateDuplicateSessions(sessionResults, keepSessionId) {
        for (var i = 0; i < sessionResults.length; i++) {
            var sessionId = sessionResults[i].getValue({ name: 'internalid' });
            if (String(sessionId) !== String(keepSessionId)) {
                deactivateSession(sessionId);
            }
        }
    }

    function logout(token) {
        if (!token) return;

        var result = search.create({
            type: SESSION_RECORD,
            filters: [[FIELD_SESSION_TOKEN, 'is', token]],
            columns: ['internalid']
        }).run().getRange({ start: 0, end: 1 });

        if (result && result.length) {
            deactivateSession(result[0].getValue({ name: 'internalid' }));
        }
    }

    function deactivateSession(sessionId) {
        try {
            var values = {};
            values[FIELD_SESSION_ACTIVE] = false;
            record.submitFields({
                type: SESSION_RECORD,
                id: sessionId,
                values: values
            });
        } catch (e) {
            log.error('Failed to deactivate VS Production external session', e);
        }
    }

    function buildSessionValues(userId, token, clientIp, startDate, endDate, active) {
        var values = {};
        values[FIELD_SESSION_USER] = userId;
        values[FIELD_SESSION_TOKEN] = token;
        values[FIELD_SESSION_IP] = clientIp || '';
        values[FIELD_SESSION_START] = startDate;
        values[FIELD_SESSION_END] = endDate;
        values[FIELD_SESSION_ACTIVE] = active;
        return values;
    }

    function generateToken(userId) {
        return [
            userId,
            new Date().getTime(),
            Math.floor(Math.random() * 1000000)
        ].join('_');
    }

    function setCookie(response, token) {
        response.addHeader({
            name: 'Set-Cookie',
            value: COOKIE_NAME + '=' + encodeURIComponent(token) + '; path=/; HttpOnly; SameSite=Lax'
        });
    }

    function clearCookie(response) {
        response.addHeader({
            name: 'Set-Cookie',
            value: COOKIE_NAME + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
        });
    }

    return {
        COOKIE_NAME: COOKIE_NAME,
        getCookie: getCookie,
        getSessionToken: getSessionToken,
        validateSession: validateSession,
        createOrUpdateSession: createOrUpdateSession,
        logout: logout,
        setCookie: setCookie,
        clearCookie: clearCookie
    };
});
