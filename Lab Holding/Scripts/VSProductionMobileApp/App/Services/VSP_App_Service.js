/**
 * @NApiVersion 2.1
 * @Filename VSP_App_Service.js
 */

define([
    'N/file',
    'N/log',
    'N/url',
    'N/runtime',
    '../../Util/LIB_VSP_External_Session.js',
    '../../Util/LIB_VSP_Subscription_Check.js',
    './User_Service.js'
], function (file, log, url, runtime, sessionLib, subscriptionCheck, userService) {
    var LOGIN_SCRIPT_ID = 'customscript_vsp_external_login';
    var LOGIN_DEPLOYMENT_ID = 'customdeploy_vsp_external_login';
    var APP_SCRIPT_ID = 'customscript_vsp_external_app';
    var APP_DEPLOYMENT_ID = 'customdeploy_vsp_external_app';
    var PORTAL_ROOT_PARAM = 'custscript_vsp_portal_root_path';
    var DEFAULT_PORTAL_ROOT = 'SuiteScripts/VSProductionMobileApp';
    var HEADER_CSS_PATH = 'App/SharedHeader/VSP_Header.css';
    var HEADER_JS_PATH = 'App/SharedHeader/VSP_Header.js';
    var COMMON_CSS_PATH = 'App/SharedHeader/VSP_Common.css';
    var PAGE_FILES = {
        home: {
            html: 'App/Home/VSP_Home.html',
            js: 'App/Home/VSP_Home.js'
        }
    };

    function onRequest(context) {
        if (!ensureSubscription(context, context.request.method === 'POST')) return;

        var session = getValidSessionOrRedirect(context);
        if (!session) return;

        if (context.request.method === 'GET') {
            renderApp(context);
            return;
        }

        handlePost(context, session.userId);
    }

    function ensureSubscription(context, isJsonResponse) {
        var status = subscriptionCheck.check();
        if (status.allowed) return true;

        if (isJsonResponse) {
            writeJson(context.response, {
                success: false,
                message: status.label.title + '\n\n' + status.label.text
            });
        } else {
            renderMessage(context.response, status.label.title, status.label.text);
        }

        return false;
    }

    function handlePost(context, userId) {
        try {
            var body = JSON.parse(context.request.body || '{}');
            var action = body.action;

            if (action === 'bootstrapHome') {
                writeJson(context.response, {
                    success: true,
                    data: getHomeBootstrap(userId)
                });
                return;
            }

            if (action === 'logout') {
                sessionLib.logout(sessionLib.getSessionToken(context));
                sessionLib.clearCookie(context.response);
                writeJson(context.response, {
                    success: true,
                    redirectUrl: getLoginUrl()
                });
                return;
            }

            writeJson(context.response, {
                success: false,
                message: 'Unknown action.'
            });
        } catch (e) {
            log.error('VS Production App Error', e);
            writeJson(context.response, {
                success: false,
                message: e.message || 'Server error.'
            });
        }
    }

    function getValidSessionOrRedirect(context) {
        var token = sessionLib.getSessionToken(context);
        var session = sessionLib.validateSession(token);

        if (session && session.userId) {
            return session;
        }

        sessionLib.clearCookie(context.response);
        context.response.write('<script>window.location.href="' + getLoginUrl() + '";</script>');
        return null;
    }

    function renderApp(context) {
        var pageKey = getPageKey(context.request.parameters.page);
        var pageFiles = PAGE_FILES[pageKey];
        var html = file.load({ id: portalPath(pageFiles.html) }).getContents();
        var headerCssUrl = file.load({ id: portalPath(HEADER_CSS_PATH) }).url;
        var headerJsUrl = file.load({ id: portalPath(HEADER_JS_PATH) }).url;
        var commonCssUrl = file.load({ id: portalPath(COMMON_CSS_PATH) }).url;
        var pageJsUrl = file.load({ id: portalPath(pageFiles.js) }).url;

        html = html
            .replace(/\{\{HEADER_CSS_URL\}\}/g, headerCssUrl)
            .replace(/\{\{HEADER_JS_URL\}\}/g, headerJsUrl)
            .replace(/\{\{COMMON_CSS_URL\}\}/g, commonCssUrl)
            .replace(/\{\{PAGE_JS_URL\}\}/g, pageJsUrl);

        context.response.write(html);
    }

    function getHomeBootstrap(userId) {
        return {
            user: userService.getUserContext(userId),
            homeUrl: getAppUrl('home')
        };
    }

    function portalPath(relativePath) {
        var root = runtime.getCurrentScript().getParameter({ name: PORTAL_ROOT_PARAM }) || DEFAULT_PORTAL_ROOT;
        root = String(root).replace(/\/+$/, '');
        return root + '/' + String(relativePath).replace(/^\/+/, '');
    }

    function getPageKey(page) {
        if (page === 'home') return page;
        return 'home';
    }

    function getLoginUrl() {
        return url.resolveScript({
            scriptId: LOGIN_SCRIPT_ID,
            deploymentId: LOGIN_DEPLOYMENT_ID,
            returnExternalUrl: true
        });
    }

    function getAppUrl(page) {
        return url.resolveScript({
            scriptId: APP_SCRIPT_ID,
            deploymentId: APP_DEPLOYMENT_ID,
            returnExternalUrl: true,
            params: {
                page: page
            }
        });
    }

    function renderMessage(response, title, text) {
        response.write(
            '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1">' +
            '<title>' + escapeHtml(title) + '</title>' +
            '<style>body{margin:0;font-family:Arial,sans-serif;background:#f4f6f8;color:#1f2937;}' +
            'main{min-height:100vh;display:grid;place-items:center;padding:24px;}' +
            'section{max-width:560px;background:#fff;border:1px solid #d7dce3;border-radius:8px;padding:24px;box-shadow:0 18px 48px rgba(15,23,42,.12);}' +
            'h1{margin:0 0 10px;font-size:22px;}p{margin:0;color:#4b5563;line-height:1.5;}</style>' +
            '</head><body><main><section><h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(text) +
            '</p></section></main></body></html>'
        );
    }

    function writeJson(response, payload) {
        response.setHeader({
            name: 'Content-Type',
            value: 'application/json'
        });
        response.write(JSON.stringify(payload));
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    return {
        onRequest: onRequest
    };
});
