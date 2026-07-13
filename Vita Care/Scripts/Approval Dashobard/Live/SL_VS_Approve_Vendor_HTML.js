/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @Filename SL || Approve Vendor HTML
 * @Description Vendor Approval Dashboard (Workflow-driven, HTML frontend)
 */

define(['N/file', 'N/runtime', 'N/search', 'N/record', 'N/workflow', 'N/log', 'N/url'],
(file, runtime, search, record, workflow, log, url) => {

    const WORKFLOW_ID = 'customworkflow_vs_vendorapproval';

    function onRequest(context) {
        try {
            if (context.request.method === 'GET') {
                serveHtml(context);
            } else {
                handlePost(context);
            }
        } catch (e) {
            log.error('Suitelet Error', e);
            context.response.write(JSON.stringify({ success: false, message: e.message }));
        }
    }

    /* =====================================================
     * GET → SERVE HTML
     * ===================================================== */
    function serveHtml(context) {
        const htmlFile = file.load({ id: 'SuiteScripts/Approval Dashboard/Vendor_Approval_Dashboard.html' });
        var htmlContent = htmlFile.getContents();

        const cssFile = file.load({ id: 'SuiteScripts/Approval Dashboard/Vendor_Approval_Dashboard.css' });
        var cssUrl = cssFile.url;

        htmlContent = htmlContent.replace(
            '<link rel="stylesheet" href="Vendor_Approval_Dashboard.css">',
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
                result = getVendors();
                break;
            case 'approve':
                result = approveVendors(body.ids || []);
                break;
            case 'reject':
                result = rejectVendors(body.ids || []);
                break;
            case 'view_record':
                var recordUrl = url.resolveRecord({
                    recordType: 'vendor',
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
     * PERMISSION MAP
     * level → { employees: [], roles: [] }
     * ===================================================== */
    const PERMISSION_MAP = {
        'AP Accountant Review':          { employees: [170176, 351237],        roles: [3] },
        'Supply & Demand Leader Review': { employees: [425161, 413502],        roles: [3] },
        'Commercial Director Review':    { employees: [53991],                 roles: [3] },
        'CFO Approval':                  { employees: [1133],                  roles: [3] },
        'CEO Approval':                  { employees: [53984],                 roles: [3] },
        'HR Manager Review':             { employees: [99130],                 roles: [3] }
    };

    /* =====================================================
     * APPROVE ACTION MAP  (level → workflowaction)
     *
     * Note: "AP Accountant Review" appears TWICE in the
     * workflow (states 190 and 421). The second occurrence
     * comes after HR Manager Review. We resolve which
     * action to use at runtime by reading the record's
     * current workflow state ID.
     * ===================================================== */
    const APPROVE_ACTION_MAP = {
        'AP Accountant Review':          'workflowaction1107',   // workflowstate190 (first pass)
        'Supply & Demand Leader Review': 'workflowaction2138',
        'Commercial Director Review':    'workflowaction2104',
        'CFO Approval':                  'workflowaction2099',
        'CEO Approval':                  'workflowaction2144',
        'HR Manager Review':             'workflowaction1113',
        'AP Accountant Review (2)':      'workflowaction2154'    // workflowstate421 (second pass)
    };

    const REJECT_ACTION_MAP = {
        'AP Accountant Review':          'workflowaction1108',
        'Supply & Demand Leader Review': 'workflowaction2139',
        'Commercial Director Review':    'workflowaction2140',
        'CFO Approval':                  'workflowaction2100',
        'CEO Approval':                  'workflowaction2145',
        'HR Manager Review':             'workflowaction1114',
        'AP Accountant Review (2)':      'workflowaction2156'
    };

    // Map workflowstate ID → canonical level key (handles the duplicate AP Accountant state)
    const STATE_TO_LEVEL_KEY = {
        'workflowstate190': 'AP Accountant Review',
        'workflowstate419': 'Supply & Demand Leader Review',
        'workflowstate411': 'Commercial Director Review',
        'workflowstate410': 'CFO Approval',
        'workflowstate420': 'CEO Approval',
        'workflowstate192': 'HR Manager Review',
        'workflowstate421': 'AP Accountant Review (2)'
    };

    /* =====================================================
     * RESOLVE CURRENT USER'S ACCESSIBLE LEVELS
     * ===================================================== */
    function getAccessibleLevels() {
        const user   = runtime.getCurrentUser();
        const userId = user.id;
        const roleId = user.role;

        // Admin sees everything
        if (roleId == 3) return 'ALL';

        const levels = [];
        for (const [level, perm] of Object.entries(PERMISSION_MAP)) {
            if (perm.employees.includes(userId) || perm.roles.includes(roleId)) {
                levels.push(level);
            }
        }
        return levels; // array of level strings the user can act on
    }

    /* =====================================================
     * SEARCH VENDORS
     * ===================================================== */
    function getVendors() {
        const access = getAccessibleLevels();
        if (Array.isArray(access) && access.length === 0) {
            return { success: true, data: [] };
        }

        const filters = [
            ['isinactive', 'is', 'T'],
            'AND',
            ['custentity_clientapproval_currentlevel', 'isnotempty', '']
        ];

        // Non-admin: restrict to levels this user can act on
        // "AP Accountant Review" covers both state190 and state421 display-label-wise
        if (access !== 'ALL') {
            const levelFilters = access.map(l => {
                // Normalise the "(2)" alias back to the real field value for filtering
                const fieldValue = l === 'AP Accountant Review (2)' ? 'AP Accountant Review' : l;
                return ['custentity_clientapproval_currentlevel', 'is', fieldValue];
            });

            if (levelFilters.length === 1) {
                filters.push('AND', levelFilters[0]);
            } else {
                // OR together multiple levels
                const orBlock = [levelFilters[0]];
                for (let i = 1; i < levelFilters.length; i++) {
                    orBlock.push('OR', levelFilters[i]);
                }
                filters.push('AND', orBlock);
            }
        }

        const results = [];

        const vendorSearch = search.create({
            type: 'vendor',
            filters: filters,
            columns: [
                search.createColumn({ name: 'internalid', label: 'Internal ID' }),
                search.createColumn({ name: 'altname',    label: 'Name' }),
                search.createColumn({ name: 'custentity_vs_type', label: 'Type' }),
                search.createColumn({ name: 'custentity_clientapproval_currentlevel', label: 'Current Level' })
            ]
        });

        vendorSearch.run().each(r => {
            results.push({
                id:           r.id,
                name:         r.getValue('altname'),
                type:         r.getText('custentity_vs_type') || r.getValue('custentity_vs_type') || '',
                currentLevel: r.getValue('custentity_clientapproval_currentlevel')
            });
            return true;
        });

        return { success: true, data: results };
    }

    /* =====================================================
     * WORKFLOW TRIGGER
     * ===================================================== */
    function triggerWorkflow(vendorId, actionId) {
        try {
            workflow.trigger({
                recordType: 'vendor',
                recordId:   vendorId,
                workflowId: WORKFLOW_ID,
                actionId:   actionId
            });
        } catch (e) {
            log.error('workflow.trigger FAILED', {
                vendorId, actionId, workflowId: WORKFLOW_ID, error: e.message
            });
            throw e;
        }
    }

    /* =====================================================
     * RESOLVE ACTION FOR A VENDOR
     * Reads the vendor's current workflow state to pick
     * the correct action (handles the duplicate AP state).
     * ===================================================== */
    function resolveAction(vendorId, actionMap) {
        // Load the vendor record to get its current workflow state
        const vendorRecord = record.load({ type: 'vendor', id: vendorId });
        const currentLevel = vendorRecord.getValue('custentity_clientapproval_currentlevel');

        // For non-duplicate levels, level string is enough
        // For "AP Accountant Review" we need the workflow state to disambiguate
        if (currentLevel === 'AP Accountant Review') {
            // Check which state the vendor is actually in via workflow search
            const wfSearch = search.create({
                type: 'vendor',
                filters: [
                    ['internalid', 'anyof', vendorId],
                    'AND',
                    ['workflow.workflow', 'anyof', WORKFLOW_ID]
                ],
                columns: [
                    search.createColumn({ name: 'currentstate', join: 'workflow' })
                ]
            });

            let stateId = null;
            wfSearch.run().each(r => {
                stateId = r.getValue({ name: 'currentstate', join: 'workflow' });
                return false; // only need first result
            });

            log.debug('resolveAction — AP Accountant disambiguate', { vendorId, stateId });

            if (stateId) {
                const levelKey = STATE_TO_LEVEL_KEY[stateId];
                if (levelKey) return actionMap[levelKey] || null;
            }

            // Fallback: first occurrence
            return actionMap['AP Accountant Review'];
        }

        return actionMap[currentLevel] || null;
    }

    /* =====================================================
     * APPROVE
     * ===================================================== */
    function approveVendors(ids) {
        const errors = [];

        for (const vendorId of ids) {
            try {
                const actionId = resolveAction(vendorId, APPROVE_ACTION_MAP);
                log.debug('approveVendors', { vendorId, actionId });

                if (!actionId) {
                    errors.push('No approve action found for vendor ' + vendorId);
                    continue;
                }
                triggerWorkflow(vendorId, actionId);
            } catch (e) {
                errors.push('Vendor ' + vendorId + ': ' + e.message);
            }
        }

        return errors.length
            ? { success: false, message: errors.join('\n') }
            : { success: true };
    }

    /* =====================================================
     * REJECT
     * ===================================================== */
    function rejectVendors(ids) {
        const errors = [];

        for (const vendorId of ids) {
            try {
                const actionId = resolveAction(vendorId, REJECT_ACTION_MAP);
                log.debug('rejectVendors', { vendorId, actionId });

                if (!actionId) {
                    errors.push('No reject action found for vendor ' + vendorId);
                    continue;
                }
                triggerWorkflow(vendorId, actionId);
            } catch (e) {
                errors.push('Vendor ' + vendorId + ': ' + e.message);
            }
        }

        return errors.length
            ? { success: false, message: errors.join('\n') }
            : { success: true };
    }

    return { onRequest };
});