/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @Filename SL_VSP_External_Login.js
 */

define([
    'N/search',
    'N/log',
    'N/url',
    'N/crypto',
    'N/file',
    'N/config',
    'N/runtime',
    '../Util/LIB_VSP_External_Session.js',
    '../Util/LIB_VSP_Subscription_Check.js'
], function (search, log, url, crypto, file, config, runtime, sessionLib, subscriptionCheck) {
    var USER_RECORD = 'customrecord_vs_production_users';
    var FIELD_USER_EMPLOYEE = 'custrecord_vs_employee_prod';
    var FIELD_USER_PASSWORD = 'custrecord_vs_password_prod';
    var APP_SCRIPT_ID = 'customscript_vsp_external_app';
    var APP_DEPLOYMENT_ID = 'customdeploy_vsp_external_app';
    var PORTAL_ROOT_PARAM = 'custscript_vsp_portal_root_path_login';
    var DEFAULT_PORTAL_ROOT = 'SuiteScripts/VSProductionMobileApp';
    var LOGIN_HTML_PATH = 'Login/VSP_Login.html';
    var LOGIN_CSS_PATH = 'Login/VSP_Login.css';
    var LOGIN_JS_PATH = 'Login/VSP_Login.js';

    function onRequest(context) {
        if (!ensureSubscription(context, context.request.method === 'POST')) return;

        if (context.request.method === 'POST') {
            handleLogin(context);
            return;
        }

        renderLogin(context.response, '');
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

    function handleLogin(context) {
        var userFacingError = '';

        try {
            var username = (context.request.parameters.username || '').trim();
            var password = context.request.parameters.password || '';

            if (!username || !password) {
                userFacingError = 'Username and password are required.';
                throw new Error('Missing credentials');
            }

            var employeeId = findEmployeeId(username);
            if (!employeeId) {
                userFacingError = 'Invalid username or password.';
                throw new Error('Employee not found for username: ' + username);
            }

            var productionUserId = findProductionUserByEmployee(employeeId);
            if (!productionUserId) {
                userFacingError = 'Invalid username or password.';
                throw new Error('VS Production user not found for employee: ' + employeeId);
            }

            var isValid = crypto.checkPasswordField({
                recordType: USER_RECORD,
                recordId: Number(productionUserId),
                fieldId: FIELD_USER_PASSWORD,
                value: password
            });

            if (!isValid) {
                userFacingError = 'Invalid username or password.';
                throw new Error('Invalid password for VS Production user: ' + productionUserId);
            }

            var clientIp =
                context.request.headers['x-forwarded-for'] ||
                context.request.headers.remote_addr ||
                'UNKNOWN';
            var token = sessionLib.createOrUpdateSession(productionUserId, clientIp, 8);
            var appUrl = url.resolveScript({
                scriptId: APP_SCRIPT_ID,
                deploymentId: APP_DEPLOYMENT_ID,
                returnExternalUrl: true
            });

            sessionLib.setCookie(context.response, token);
            writeJson(context.response, {
                success: true,
                redirectUrl: appUrl
            });
        } catch (e) {
            log.error('VS Production Login Error', e);

            writeJson(context.response, {
                success: false,
                message: userFacingError || 'An unexpected error occurred. Please try again.'
            });
        }
    }

    function renderLogin(response, errorMessage) {
        var html = file.load({ id: portalPath(LOGIN_HTML_PATH) }).getContents();
        var cssUrl = file.load({ id: portalPath(LOGIN_CSS_PATH) }).url;
        var jsUrl = file.load({ id: portalPath(LOGIN_JS_PATH) }).url;
        var companyInfo = getCompanyInfo();

        html = html
            .replace('VSP_Login.css', cssUrl)
            .replace('VSP_Login.js', jsUrl)
            .replace('{{ERROR_MESSAGE}}', errorMessage || '')
            .replace(/\{\{COMPANY_LEGAL_NAME\}\}/g, escapeHtml(companyInfo.legalName || 'VS Production'))
            .replace('{{COMPANY_LOGO_URL}}', escapeAttr(companyInfo.logoUrl || ''))
            .replace('{{COMPANY_LOGO_CLASS}}', companyInfo.logoUrl ? 'company-logo' : 'company-logo hidden')
            .replace('{{BRAND_MARK_CLASS}}', companyInfo.logoUrl ? 'brand-mark hidden' : 'brand-mark');

        response.write(html);
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

    function portalPath(relativePath) {
        var root = runtime.getCurrentScript().getParameter({ name: PORTAL_ROOT_PARAM }) || DEFAULT_PORTAL_ROOT;
        root = String(root).replace(/\/+$/, '');
        return root + '/' + String(relativePath).replace(/^\/+/, '');
    }

    function getCompanyInfo() {
        try {
            var companyInfo = config.load({ type: config.Type.COMPANY_INFORMATION });
            var legalName = companyInfo.getValue({ fieldId: 'legalname' }) ||
                companyInfo.getValue({ fieldId: 'companyname' }) ||
                'VS Production';

            return {
                legalName: legalName,
                logoUrl: getCompanyLogoUrl(companyInfo)
            };
        } catch (e) {
            log.error('Unable to load VS Production login company information', e);
            return {
                legalName: 'VS Production',
                logoUrl: ''
            };
        }
    }

    function getCompanyLogoUrl(companyInfo) {
        var logoFieldIds = ['formlogo', 'pagelogo', 'logo'];

        for (var i = 0; i < logoFieldIds.length; i++) {
            try {
                var logoFileId = companyInfo.getValue({ fieldId: logoFieldIds[i] });
                if (logoFileId) {
                    return file.load({ id: logoFileId }).url;
                }
            } catch (e) {
                log.debug('VS Production login company logo field unavailable', logoFieldIds[i]);
            }
        }

        return '';
    }

    function findEmployeeId(username) {
        var filters = [
            ['email', 'is', username],
            'OR',
            ['entityid', 'is', username]
        ];

        if (/^\d+$/.test(username)) {
            filters = [filters, 'OR', ['internalidnumber', 'equalto', Number(username)]];
        }

        var result = search.create({
            type: search.Type.EMPLOYEE,
            filters: filters,
            columns: ['internalid']
        }).run().getRange({ start: 0, end: 1 });

        if (!result || !result.length) return '';
        return result[0].getValue({ name: 'internalid' });
    }

    function findProductionUserByEmployee(employeeId) {
        var result = search.create({
            type: USER_RECORD,
            filters: [
                [FIELD_USER_EMPLOYEE, 'anyof', employeeId],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        }).run().getRange({ start: 0, end: 1 });

        if (!result || !result.length) return '';
        return result[0].getValue({ name: 'internalid' });
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

    function escapeAttr(value) {
        return escapeHtml(value);
    }

    return {
        onRequest: onRequest
    };
});
