/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @Filename SL || Client Approval Dashboard
 * @Description Client Approval Dashboard (Workflow-driven, HTML frontend)
 */

define(['N/file', 'N/runtime', 'N/search', 'N/record', 'N/workflow', 'N/log', 'N/url'], (file, runtime, search, record, workflow, log, url) => {

    const WORKFLOW_ID = 'customworkflow_vs_client_approval_new';

    /* =====================================================
     * ENTRY POINT
     * ===================================================== */
    function onRequest(context) {
        try {
            if (context.request.method === 'GET') {
                serveHtml(context);
            } else {
                handlePost(context);
            }
        } catch (e) {
            log.error('Suitelet Error', e);
            context.response.write(JSON.stringify({
                success: false,
                message: e.message
            }));
        }
    }

    /* =====================================================
     * GET → SERVE HTML
     * ===================================================== */
    function serveHtml(context) {
        const htmlFile = file.load({ id: 'SuiteScripts/Approval Dashboard/Client_Approval_Dashboard.html' });
        var htmlContent = htmlFile.getContents();

        const cssFile = file.load({ id: 'SuiteScripts/Approval Dashboard/Client_Approval_Dashboard.css' });
        var cssUrl = cssFile.url;

        htmlContent = htmlContent.replace(
            '<link rel="stylesheet" href="client_approval.css">',
            '<link rel="stylesheet" href="' + cssUrl + '">'
        );

        context.response.write(htmlContent);
    }

    /* =====================================================
     * POST ROUTER
     * ===================================================== */
    function handlePost(context) {
        const body = JSON.parse(context.request.body || '{}');
        let result;

        switch (body.action) {
            case 'getData':
                result = getClients(body);
                break;

            case 'approve':
                result = approveClients(body.ids || []);
                break;

            case 'reject':
                result = rejectClients(body.ids || []);
                break;

            case 'view_record':
                var recordUrl = url.resolveRecord({
                    recordType: 'customer',
                    recordId: body.id,
                    isEditMode: false
                });
                context.response.write(JSON.stringify({ url: recordUrl }));
                return;

            default:
                result = { success: false, message: 'Invalid action' };
        }

        context.response.write(JSON.stringify(result));
    }

    /* =====================================================
     * USER APPROVAL LEVEL (ROLE / EMPLOYEE BASED)
     * ===================================================== */
    function getUserApprovalLevel() {
        const user = runtime.getCurrentUser();
        log.debug('Current user', { id: user.id, role: user.role, roleId: user.roleId });

        // Administrator → ALL (role 3 = Administrator, role 31 = Full Access)
        if (user.role == 3 || user.role == 31) {
            return 'ALL';
        }

        const EMPLOYEE_LEVEL_MAP = {
            '292': 'E-292',   // Mohammed Abdelsalam
            '10': 'E-10',    // Mostafa I Yakoub
            '16': 'E-16',    // Oday Tayseer Othman
            '30': 'E-30',    // Muhannad Mahmoud Musleh
            '9': 'E-9',     // Waleed Mansour Sayed Ahmed
            '26': 'E-26'     // CEO
        };

        const ROLE_LEVEL_MAP = {
            'customrole_ar_approver': 'AR',
            'customrole_sales_manager': 'SalesManager'
        };

        if (ROLE_LEVEL_MAP[user.roleId]) {
            return ROLE_LEVEL_MAP[user.roleId];
        }

        const employeeId = String(user.id);
        if (EMPLOYEE_LEVEL_MAP[employeeId]) {
            return EMPLOYEE_LEVEL_MAP[employeeId];
        }

        return null;
    }

    /* =====================================================
     * SEARCH CLIENTS
     * ===================================================== */
    function getClients(params) {
        const level = getUserApprovalLevel();
        if (!level) {
            return { success: true, data: [] };
        }

        const filters = [
            ['isinactive', 'is', 'T'],
            'AND',
            ['custentity_vs_validatedbyfc', 'is', 'F'],
            'AND',
            ['custentity_clientapproval_currentlevel', 'isnotempty', '']
        ];

        if (level !== 'ALL') {
            filters.push('AND', ['custentity_clientapproval_currentlevel', 'is', level]);
        }

        const results = [];

        const clientSearch = search.create({
            type: search.Type.CUSTOMER,
            filters: filters,
            columns: [
                search.createColumn({ name: 'altname', label: 'Name' }),
                search.createColumn({ name: 'internalid', label: 'Internal ID' }),
                search.createColumn({ name: 'custentity_clientapproval_currentlevel', label: 'Current Level' }),
                search.createColumn({ name: 'custentity_vs_client_next_approval', label: 'Next Approval' })
            ]
        });

        clientSearch.run().each(r => {
            results.push({
                id: r.id,
                name: r.getValue('altname'),
                currentLevel: r.getValue('custentity_clientapproval_currentlevel'),
                nextApproval: r.getValue('custentity_vs_client_next_approval')
            });
            return true;
        });

        return { success: true, data: results };
    }

    /* =====================================================
     * WORKFLOW TRIGGER
     * ===================================================== */
    function triggerWorkflow(recordId, actionId) {
        try {
            workflow.trigger({
                recordType: 'customer',
                recordId: recordId,
                workflowId: WORKFLOW_ID,
                actionId: actionId
            });
        } catch (e) {
            log.error('workflow.trigger FAILED', {
                recordId: recordId,
                actionId: actionId,
                workflowId: WORKFLOW_ID,
                error: e.message
            });
            throw e;
        }
    }

    /* =====================================================
     * LEVEL → ACTION MAPS
     * ===================================================== */
    const APPROVE_ACTION_MAP = {
        // Canonical level values
        'AR': 'workflowaction_clientapproval_approve_ar',
        'SalesManager': 'workflowaction_clientapproval_approve_sm',
        'E-292': 'workflowaction_clientapproval_approve_al',
        'E-10': 'workflowaction_clientapproval_approve_ya',
        'E-16': 'workflowaction_clientapproval_approve_od',
        'E-30': 'workflowaction_clientapproval_approve_mu',
        'E-9': 'workflowaction_clientapproval_approve_wa',
        'E-26': 'workflowaction_clientapproval_approve_ce',
        // Legacy aliases found in existing records
        'Oday': 'workflowaction_clientapproval_approve_od',
        'Muhannad': 'workflowaction_clientapproval_approve_mu',
        'RegionalManagerEast': 'workflowaction_clientapproval_approve_al',
        'RegionalManagerWest': 'workflowaction_clientapproval_approve_ya'
    };

    const REJECT_ACTION_MAP = {
        // Canonical level values
        'AR': 'workflowaction1920',
        'SalesManager': 'workflowaction1998',
        'E-292': 'workflowaction2012',
        'E-10': 'workflowaction2005',
        'E-16': 'workflowaction1923',
        'E-30': 'workflowaction1926',
        'E-9': 'workflowaction1929',
        'E-26': 'workflowaction_clientapproval_reject_ce',
        // Legacy aliases found in existing records
        'Oday': 'workflowaction1923',
        'Muhannad': 'workflowaction1926',
        'RegionalManagerEast': 'workflowaction_clientapproval_approve_al',
        'RegionalManagerWest': 'workflowaction2005'
    };

    /* =====================================================
     * APPROVE
     * ===================================================== */
    function approveClients(ids) {
        const level = getUserApprovalLevel();
        const errors = [];

        for (let i = 0; i < ids.length; i++) {
            const clientId = ids[i];
            let actionId = null;

            if (level === 'ALL') {
                actionId = resolveAdminAction(clientId, APPROVE_ACTION_MAP);
            } else {
                actionId = APPROVE_ACTION_MAP[level] || null;
            }

            log.debug('approveClients', { level, actionId, clientId });

            if (!actionId) {
                log.error('approveClients — no actionId resolved', { level, clientId });
                errors.push('No action found for client ' + clientId + ' at level ' + level);
                continue;
            }

            try {
                triggerWorkflow(clientId, actionId);
            } catch (e) {
                errors.push('Client ' + clientId + ': ' + e.message);
            }
        }

        if (errors.length) {
            return { success: false, message: errors.join('\n') };
        }

        return { success: true };
    }

    /* =====================================================
     * REJECT
     * ===================================================== */
    function rejectClients(ids) {
        const level = getUserApprovalLevel();
        const errors = [];

        for (let i = 0; i < ids.length; i++) {
            const clientId = ids[i];
            let actionId = null;

            if (level === 'ALL') {
                actionId = resolveAdminAction(clientId, REJECT_ACTION_MAP);
            } else {
                actionId = REJECT_ACTION_MAP[level] || null;
            }

            log.debug('rejectClients', { level, actionId, clientId });

            if (!actionId) {
                log.error('rejectClients — no actionId resolved', { level, clientId });
                errors.push('No action found for client ' + clientId + ' at level ' + level);
                continue;
            }

            try {
                triggerWorkflow(clientId, actionId);
            } catch (e) {
                errors.push('Client ' + clientId + ': ' + e.message);
            }
        }

        if (errors.length) {
            return { success: false, message: errors.join('\n') };
        }

        return { success: true };
    }

    /* =====================================================
     * ADMIN HELPER — resolves action based on record's current level
     * ===================================================== */
    function resolveAdminAction(clientId, actionMap) {
        const client = record.load({
            type: 'customer',
            id: clientId
        });

        const currentLevel = client.getValue('custentity_clientapproval_currentlevel');
        log.error({
            title: 'resolveAdminAction',
            details: {
                clientId: clientId,
                currentLevel: currentLevel,
                actionId: actionMap[currentLevel]
            }
        });
        return actionMap[currentLevel] || null;
    }

    return { onRequest };
});