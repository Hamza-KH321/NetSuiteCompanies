/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 *
 * PO Approval - shared library.
 * Script replacement for:
 *   customworkflow_vs_po_approval_initialize  (router)
 *   customworkflow_vs_po_approval_2 .. _6     (tier approval chains)
 */
define(['N/record', 'N/search', 'N/email', 'N/url', 'N/format', 'N/log'],
    (record, search, email, url, format, log) => {

    // =====================================================================
    // CONFIG  - values masked as [ACCOUNT_SPECIFIC_VALUE] in the SDF export
    //           must be filled in with internal IDs from the account.
    // =====================================================================
    const CONFIG = {
        START_DATE: new Date(2026, 6, 8),            // initializer: trandate >= 2026-07-08

        SENDER: null,                                 // TODO employee id used as email author

        // Role INTERNAL ids (script ids in comments). Administrator is always 3.
        ROLES: {
            ADMIN: 3,
            PURCHASING: null,   // customrole_futurepioneer_purchasing
            SOP: null,          // customrole1150
            COMM_DIR: null,     // customrole1057
            CONTROLLER: null,   // customrole_futurepioneer_controller
            CFO: null,          // customrole_futurepioneer_cfo
            ROLE_1069: null,    // customrole1069
            CEO: null           // customrole1064
        },

        // Employee internal ids allowed to act (workflow "User IN (EmployeeX)")
        EMPLOYEES: {
            VERIFIERS: [],      // 3 employees - Verification Process Submit / Reject
            SOP_APPROVERS: [],  // 2 employees - S&OP Approve / Reject (tier 3)
            COMM_DIR_EXTRA: [], // 1 employee  - extra approver at Commercial Director
            LOCK_EXEMPT: []     // 1 employee  - may still edit LOCK_EXEMPT_DOCS after End State
        },

        // Email recipients (employee ids) per stage
        EMAILS: {
            VERIFICATION: [],   // 3 emails on entering Verification Process
            SOP: [],            // 2 emails on entering S&OP Approval
            COMM_DIR: [],       // Commercial Director Approval
            CFO: [],            // CFO Approval
            CEO: [],            // CEO Approval
            CFO_REJ: [],        // "CFO Reject (Commercial Director)"
            CEO_REJ: []         // "CEO Reject (CFO)"
        },

        // BD Manager emails (approval + "rejected back to BD Manager"),
        // by Warehouse (custbody_ns_vc_asn_warehouse id) and PO Class Type text.
        BD_EMAIL_RULES: [
            { warehouses: ['2'],      classes: ['PHARMA'],                         recipients: [] },
            { warehouses: ['1', '2'], classes: ['ANIMAL HEALTH'],                  recipients: [] },
            { warehouses: ['2'],      classes: ['MEDICAL'],                        recipients: [] },
            { warehouses: ['2'],      classes: ['NON PHARMA'],                     recipients: [] },
            { warehouses: ['1'],      classes: ['NON PHARMA', 'PHARMA', 'MEDICAL'], recipients: [] },
            { warehouses: ['2'],      classes: ['NON PHARMA', 'PHARMA', 'MEDICAL'], recipients: [] }
        ],

        // Display names used in "Current Approver" and the history log
        ROLE_LABELS: {
            ADMIN: 'Administrator',
            PURCHASING: 'Purchasing',
            SOP: 'S&OP',
            COMM_DIR: 'Commercial Director',
            CONTROLLER: 'Controller',
            CFO: 'CFO',
            ROLE_1069: 'customrole1069',
            CEO: 'CEO'
        },

        LOCK_EXEMPT_DOCS: ['PO11276', 'PO11277', 'PO11279', 'PO11281', 'PO11282', 'PO11283',
            'PO11284', 'PO11285', 'PO11286', 'PO11287', 'PO11301', 'PO11302', 'PO11303',
            'PO11305', 'PO11321', 'PO11460', 'PO11464', 'PO11291', 'PO11461', 'PO11462',
            'PO11463', 'PO11465']
    };

    // =====================================================================
    // FIELDS
    // =====================================================================
    const F = {
        // ---- NEW fields (create on Purchase Order) ----
        STAGE: 'custbody_vs_po_appr_stage',      // Free-Form Text (hidden)  - stage code
        TIER: 'custbody_vs_po_appr_tier',        // Free-Form Text (hidden)  - tier code
        FLOW: 'custbody_vs_po_appr_flow',        // Free-Form Text           - Approval Workflow
        STEP: 'custbody_vs_po_appr_step',        // Free-Form Text           - Current Approval Step
        CURRENT: 'custbody_vs_po_appr_current',  // Text Area                - Current Approver(s)
        HISTORY: 'custbody_vs_po_appr_history',  // Long Text                - Approval History
        // ---- existing fields ----
        MONTHS: 'custbody_vs_months',
        TOTAL_CHANGED: 'custbody_vs_total_changed',
        TOTAL_CHANGED_WF: 'custbody_vs_total_changed_wf',
        MODIFIED_BY: 'custbody_vs_modified_by',
        BD_MGR: 'custbody_vs_bd_manager',
        BD_MGR_1: 'custbody_vs_bs_manager_1',
        BD_MGR_2: 'custbody_vs_bd_manager_2',
        CURR_ROLE: 'custbody_vc_curr_role',
        PO_APPROVED: 'custbody_vs_po_approved',
        SEND_TO_INT: 'custbody_vs_sendtointegration',
        JE_APP_ROLE: 'custbody_ali_je_app_role',
        PARENT_SO: 'custbody_vs_parentsalesorder',
        WAREHOUSE: 'custbody_ns_vc_asn_warehouse',
        CLASS_TYPE: 'custbody_vs_po_class_type',
        EXPIRY: 'custbody_vs_poexpirydate',
        DOC_NUMBER: 'custbody_itr_doc_number',
        APPROVAL_STATUS: 'approvalstatus',
        NEXT_APPROVER: 'nextapprover'
    };

    const APPROVAL = { PENDING: 1, APPROVED: 2, REJECTED: 3 };

    // =====================================================================
    // STAGES & TIERS
    // =====================================================================
    const S = {
        INITIAL: 'INITIAL',
        VERIFICATION: 'VERIFICATION',
        BD: 'BD_MANAGER',
        SOP: 'SOP',
        SOP_REJ: 'SOP_REJ_BD',
        CD: 'COMM_DIR',
        CD_REJ: 'CD_REJ_BD',
        CFO: 'CFO',
        CFO_REJ: 'CFO_REJ_CD',
        CEO: 'CEO',
        CEO_REJ: 'CEO_REJ_CFO',
        APPROVED: 'APPROVED',
        END: 'END',
        REJECTED: 'REJECTED'
    };

    // chain   = approval steps after Verification, in order
    // recheck = stages where a Total change re-routes the PO (workflow "Total Re-Check")
    const TIERS = {
        T2: { label: 'T2 - Total <= 50K, or Total <= 500K and Months <= 2', workflow: 'customworkflow_vs_po_approval_2', chain: [S.BD],
              recheck: [S.INITIAL, S.VERIFICATION, S.BD, S.APPROVED] },
        T3: { label: 'T3 - Total < 500K and 2 < Months <= 3', workflow: 'customworkflow_vs_po_approval_3', chain: [S.BD, S.SOP],
              recheck: [S.INITIAL, S.VERIFICATION, S.BD, S.SOP] },
        T4: { label: 'T4 - Total < 500K and Months > 3', workflow: 'customworkflow_vs_po_approval_4', chain: [S.BD, S.CD],
              recheck: [S.INITIAL, S.VERIFICATION, S.BD, S.CD] },
        T5: { label: 'T5 - Total > 500K and <= 1M', workflow: 'customworkflow_vs_po_approval_5', chain: [S.BD, S.CD, S.CFO],
              recheck: [S.INITIAL, S.VERIFICATION, S.BD, S.CD] },
        T6: { label: 'T6 - Total > 1M', workflow: 'customworkflow_vs_po_approval_6', chain: [S.BD, S.CD, S.CFO, S.CEO],
              recheck: [S.INITIAL, S.VERIFICATION, S.BD, S.CD] }
    };

    const STAGE_LABELS = {
        [S.INITIAL]: 'Initial - Pending Submission',
        [S.VERIFICATION]: 'Verification Process',
        [S.BD]: 'BD Manager Approval',
        [S.SOP]: 'S & OP Approval',
        [S.SOP_REJ]: 'S & OP Reject (BD Manager)',
        [S.CD]: 'Commercial Director Approval',
        [S.CD_REJ]: 'Commercial Director Reject (BD Manager)',
        [S.CFO]: 'CFO Approval',
        [S.CFO_REJ]: 'CFO Reject (Commercial Director)',
        [S.CEO]: 'CEO Approval',
        [S.CEO_REJ]: 'CEO Reject (CFO)',
        [S.APPROVED]: 'Approved - Pending Send to Integration',
        [S.END]: 'Approved - Sent to Integration',
        [S.REJECTED]: 'Rejected'
    };

    const ACTION_VERBS = {
        submit: 'Submitted', approve: 'Approved', reject: 'Rejected',
        resubmit: 'Re-submitted', integrate: 'Sent to Integration'
    };

    /** e.g. "T5 - Total > 500K and <= 1M: Verification > BD Manager > ... > Approved" */
    const flowText = (tierKey) => {
        const steps = [S.VERIFICATION].concat(TIERS[tierKey].chain)
            .map((s) => STAGE_LABELS[s].replace(' Approval', '').replace(' Process', ''));
        return `${TIERS[tierKey].label}: ${steps.join(' > ')} > Approved`;
    };

    /** Router - customworkflow_vs_po_approval_initialize */
    const routeTier = (total, months) => {
        if (total <= 50000) return 'T2';
        if (total > 1000000) return 'T6';
        if (total > 500000) return 'T5';
        if (months <= 2) return 'T2';
        if (months <= 3) return 'T3';
        return 'T4';
    };

    // =====================================================================
    // PERMISSION RULES
    // =====================================================================
    const ALL_BD = [F.BD_MGR, F.BD_MGR_1, F.BD_MGR_2];
    const bdRule = (fields) => ({ roles: ['ADMIN'], bdFields: fields || ALL_BD, totalChanged: false });
    const rolesRule = (...roles) => ({ roles, totalChanged: false });
    const RESUBMIT = {
        label: 'Re-Submit for Approval',
        rule: { roles: ['ADMIN'], modifiedBy: true, totalChanged: true },
        to: S.INITIAL
    };

    /**
     * Stage definition for a tier: what happens on entry and which buttons exist.
     */
    const stageDef = (stage, tierKey) => {
        const tier = TIERS[tierKey];
        const next = (s) => tier.chain[tier.chain.indexOf(s) + 1] || S.APPROVED;

        switch (stage) {
            case S.INITIAL:
                return {
                    onEntry: { [F.TOTAL_CHANGED]: false },
                    actions: {
                        submit: { label: 'Submit for Approval', rule: { any: true }, to: S.VERIFICATION,
                                  set: { [F.TOTAL_CHANGED_WF]: false } },
                        reject: { label: 'Reject', rule: { any: true }, to: S.REJECTED }
                    }
                };

            case S.VERIFICATION: {
                const rule = { roles: ['ADMIN'], employees: 'VERIFIERS' };
                return {
                    emails: { list: 'VERIFICATION', kind: 'approval' },
                    actions: {
                        submit: { label: 'Submit for Approval', rule, to: S.BD },
                        reject: { label: 'Reject', rule, to: S.INITIAL }
                    }
                };
            }

            case S.BD: {
                // Tier 6 only lets BD Manager + BD Manager 1 act at this step
                const rule = bdRule(tierKey === 'T6' ? [F.BD_MGR, F.BD_MGR_1] : ALL_BD);
                return {
                    currRole: 'PURCHASING',
                    emails: { rules: true, kind: 'approval' },
                    actions: {
                        approve: { label: 'Approve', rule, to: next(S.BD) },
                        reject: { label: 'Reject', rule, to: S.INITIAL },
                        resubmit: RESUBMIT
                    }
                };
            }

            case S.SOP: {
                const rule = { employees: 'SOP_APPROVERS', totalChanged: false };
                return {
                    currRole: 'SOP',
                    emails: { list: 'SOP', kind: 'approval' },
                    actions: {
                        approve: { label: 'Approve', rule, to: next(S.SOP) },
                        reject: { label: 'Reject', rule, to: S.SOP_REJ },
                        resubmit: RESUBMIT
                    }
                };
            }

            case S.SOP_REJ:
                return {
                    currRole: 'PURCHASING',
                    emails: { rules: true, kind: 'rejected' },
                    actions: {
                        approve: { label: 'Approve', rule: bdRule(), to: S.SOP },
                        reject: { label: 'Reject', rule: bdRule(), to: S.INITIAL },
                        resubmit: RESUBMIT
                    }
                };

            case S.CD:
                return {
                    currRole: 'COMM_DIR',
                    emails: { list: 'COMM_DIR', kind: 'approval' },
                    actions: {
                        approve: { label: 'Approve', to: next(S.CD),
                                   rule: { roles: ['ADMIN', 'COMM_DIR'], employees: 'COMM_DIR_EXTRA', totalChanged: false } },
                        reject: { label: 'Reject', to: S.CD_REJ,
                                  rule: { roles: ['ADMIN', 'COMM_DIR'], totalChanged: false,
                                          employees: tierKey === 'T6' ? 'COMM_DIR_EXTRA' : null } },
                        resubmit: RESUBMIT
                    }
                };

            case S.CD_REJ:
                return {
                    currRole: 'PURCHASING',
                    emails: { rules: true, kind: 'rejected' },
                    actions: {
                        approve: { label: 'Approve', rule: bdRule(), to: S.CD },
                        reject: { label: 'Reject', rule: bdRule(), to: S.INITIAL },
                        resubmit: RESUBMIT
                    }
                };

            case S.CFO:
                return {
                    currRole: 'CONTROLLER',
                    emails: { list: 'CFO', kind: 'approval' },
                    actions: {
                        approve: { label: 'Approve', to: next(S.CFO),
                                   rule: rolesRule('ADMIN', 'CONTROLLER', 'ROLE_1069', 'CFO') },
                        reject: { label: 'Reject', to: S.CFO_REJ, rule: rolesRule('ADMIN', 'CONTROLLER') },
                        resubmit: RESUBMIT
                    }
                };

            case S.CFO_REJ:
                return {
                    currRole: 'COMM_DIR',
                    emails: { list: 'CFO_REJ', kind: 'rejected' },
                    actions: {
                        approve: { label: 'Approve', rule: rolesRule('ADMIN', 'COMM_DIR'), to: S.CFO },
                        reject: { label: 'Reject', rule: rolesRule('ADMIN', 'COMM_DIR'), to: S.CD_REJ },
                        resubmit: RESUBMIT
                    }
                };

            case S.CEO:
                return {
                    currRole: 'CEO',
                    emails: { list: 'CEO', kind: 'approval' },
                    actions: {
                        approve: { label: 'Approve', rule: rolesRule('ADMIN', 'CEO'), to: S.APPROVED },
                        reject: { label: 'Reject', rule: rolesRule('ADMIN', 'CEO'), to: S.CEO_REJ },
                        resubmit: RESUBMIT
                    }
                };

            case S.CEO_REJ:
                return {
                    currRole: 'CONTROLLER',
                    emails: { list: 'CEO_REJ', kind: 'rejected' },
                    actions: {
                        approve: { label: 'Approve', rule: rolesRule('CONTROLLER'), to: S.CEO },
                        reject: { label: 'Reject', rule: rolesRule('CONTROLLER'), to: S.CFO_REJ },
                        resubmit: RESUBMIT
                    }
                };

            case S.APPROVED:
                return {
                    onEntry: { [F.CURR_ROLE]: '', [F.PO_APPROVED]: true, [F.NEXT_APPROVER]: '' },
                    actions: {
                        integrate: { label: 'Send PO to Integration', rule: { any: true }, to: S.END }
                    }
                };

            case S.END:
                return {
                    onEntry: { [F.APPROVAL_STATUS]: APPROVAL.APPROVED, [F.SEND_TO_INT]: true },
                    locked: true,
                    actions: {}
                };

            case S.REJECTED:
                return {
                    onEntry: {
                        [F.APPROVAL_STATUS]: APPROVAL.REJECTED, [F.JE_APP_ROLE]: '', [F.NEXT_APPROVER]: '',
                        [F.CURR_ROLE]: '', [F.SEND_TO_INT]: false, [F.PO_APPROVED]: false
                    },
                    actions: {}
                };

            default:
                return { actions: {} };
        }
    };

    // =====================================================================
    // HELPERS
    // =====================================================================
    const asIdList = (v) => (Array.isArray(v) ? v : (v ? [v] : [])).map(String);
    const isChecked = (v) => v === true || v === 'T';
    const stripTime = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const isEligible = (rec) => {
        const d = rec.getValue({ fieldId: 'trandate' });
        return !!d && stripTime(d) >= CONFIG.START_DATE;
    };

    const routeFromRecord = (rec) => routeTier(
        Number(rec.getValue({ fieldId: 'total' })) || 0,
        Number(rec.getValue({ fieldId: F.MONTHS })) || 0
    );

    /**
     * Current stage/tier. A PO with no stage was never started by the script
     * (created before go-live / before the start date) and is ignored.
     */
    const getState = (rec) => {
        const stage = rec.getValue({ fieldId: F.STAGE });
        if (!stage) return null;
        const tier = TIERS[rec.getValue({ fieldId: F.TIER })] ? rec.getValue({ fieldId: F.TIER }) : routeFromRecord(rec);
        return { stage, tier };
    };

    /** ctx = { userId, userName, role } */
    const isAllowed = (rule, rec, ctx) => {
        if (!rule) return false;
        if (rule.totalChanged !== undefined &&
            isChecked(rec.getValue({ fieldId: F.TOTAL_CHANGED })) !== rule.totalChanged) return false;
        if (rule.any) return true;

        const userId = String(ctx.userId);
        const role = String(ctx.role);

        if ((rule.roles || []).some((k) => CONFIG.ROLES[k] && String(CONFIG.ROLES[k]) === role)) return true;
        if (rule.employees && asIdList(CONFIG.EMPLOYEES[rule.employees]).includes(userId)) return true;
        if ((rule.bdFields || []).some((f) => asIdList(rec.getValue({ fieldId: f })).includes(userId))) return true;
        if (rule.modifiedBy && asIdList(rec.getValue({ fieldId: F.MODIFIED_BY })).includes(userId)) return true;
        return false;
    };

    const getAvailableActions = (rec, ctx) => {
        const state = getState(rec);
        if (!state) return [];
        const def = stageDef(state.stage, state.tier);
        return Object.keys(def.actions || {})
            .filter((key) => isAllowed(def.actions[key].rule, rec, ctx))
            .map((key) => ({ key, label: def.actions[key].label, stage: state.stage }));
    };

    // ---------------------------------------------------------------------
    // Tracking: current approver + history
    // ---------------------------------------------------------------------
    const employeeNames = (ids) => {
        if (!ids.length) return [];
        const names = [];
        search.create({
            type: search.Type.EMPLOYEE,
            filters: [['internalid', 'anyof', ids]],
            columns: ['firstname', 'lastname', 'entityid']
        }).run().each((r) => {
            const full = `${r.getValue('firstname') || ''} ${r.getValue('lastname') || ''}`.trim();
            names.push(full || r.getValue('entityid'));
            return true;
        });
        return names;
    };

    const roleLabel = (roleId) => {
        const key = Object.keys(CONFIG.ROLES).find((k) => String(CONFIG.ROLES[k]) === String(roleId));
        return key ? CONFIG.ROLE_LABELS[key] : `Role ${roleId}`;
    };

    /** Who can act at a stage, from the rule of its main button (Administrator omitted). */
    const approverText = (rec, stage, tierKey) => {
        if (stage === S.INITIAL) return 'Requester - Submit for Approval';
        if (stage === S.APPROVED) return 'Send PO to Integration';
        const actions = stageDef(stage, tierKey).actions || {};
        const main = actions.approve || actions.submit;
        if (!main) return '';

        const rule = main.rule;
        const parts = [];
        (rule.roles || []).filter((k) => k !== 'ADMIN')
            .forEach((k) => parts.push(`${CONFIG.ROLE_LABELS[k]} (role)`));
        (rule.bdFields || []).forEach((f) => {
            const t = rec.getText({ fieldId: f });
            (Array.isArray(t) ? t : [t]).filter(Boolean).forEach((n) => parts.push(n));
        });
        if (rule.employees) {
            try {
                employeeNames(asIdList(CONFIG.EMPLOYEES[rule.employees])).forEach((n) => parts.push(n));
            } catch (e) {
                log.error('PO Approval', `Employee lookup failed: ${e.message}`);
            }
        }
        return [...new Set(parts)].join(', ');
    };

    const historyLine = (text) =>
        `${format.format({ value: new Date(), type: format.Type.DATETIME })} | ${text}`;

    // ---------------------------------------------------------------------
    // Emails
    // ---------------------------------------------------------------------
    const recipientsFor = (rec, emails) => {
        let ids = [];
        if (emails.list) {
            ids = asIdList(CONFIG.EMAILS[emails.list]);
        } else if (emails.rules) {
            const wh = String(rec.getValue({ fieldId: F.WAREHOUSE }) || '');
            const cls = String(rec.getText({ fieldId: F.CLASS_TYPE }) || rec.getValue({ fieldId: F.CLASS_TYPE }) || '')
                .trim().toUpperCase();
            CONFIG.BD_EMAIL_RULES
                .filter((r) => r.warehouses.includes(wh) && r.classes.includes(cls))
                .forEach((r) => { ids = ids.concat(asIdList(r.recipients)); });
        }
        return [...new Set(ids.filter(Boolean))];
    };

    const sendStageEmails = (rec, emails) => {
        if (!emails) return;
        const recipients = recipientsFor(rec, emails);
        if (!recipients.length) return;
        if (!CONFIG.SENDER) {
            log.error('PO Approval', 'CONFIG.SENDER is not set - email skipped');
            return;
        }

        const tranid = rec.getValue({ fieldId: 'tranid' });
        const link = 'https://' + url.resolveDomain({ hostType: url.HostType.APPLICATION }) +
            url.resolveRecord({ recordType: record.Type.PURCHASE_ORDER, recordId: rec.id });
        const subject = (emails.kind === 'rejected' ? 'PO Rejected ' : 'PO Approval ') + tranid;
        const body =
            '<p>Hello,</p><p>Kindly note that below PO needs you\'re Approval, please check.</p>' +
            `<p><strong>PO: ${tranid}</strong></p>` +
            `<p><strong>Date: ${rec.getText({ fieldId: 'trandate' }) || ''}</strong></p>` +
            `<p><strong>Expiry Date: ${rec.getText({ fieldId: F.EXPIRY }) || ''}</strong></p>` +
            `<p><strong>Total: ${rec.getText({ fieldId: 'total' }) || rec.getValue({ fieldId: 'total' })}</strong></p>` +
            '<p><strong>Thanks.</strong></p>' +
            `<p><a href="${link}">View Record</a></p>`;

        // email.send accepts max 10 recipients per call
        for (let i = 0; i < recipients.length; i += 10) {
            email.send({
                author: CONFIG.SENDER,
                recipients: recipients.slice(i, i + 10),
                subject,
                body,
                relatedRecords: { transactionId: rec.id }
            });
        }
    };

    // ---------------------------------------------------------------------
    // Transitions
    // ---------------------------------------------------------------------
    /**
     * Enter a stage: write stage/tier + entry field values, then send entry emails.
     * @param {record.Record} rec  loaded PO (used for email content / routing)
     */
    const enterStage = (rec, tierKey, stage, extraValues, historyText) => {
        const def = stageDef(stage, tierKey);
        const history = rec.getValue({ fieldId: F.HISTORY }) || '';
        const values = Object.assign({}, extraValues || {}, def.onEntry || {}, {
            [F.STAGE]: stage,
            [F.TIER]: tierKey,
            [F.FLOW]: flowText(tierKey),
            [F.STEP]: STAGE_LABELS[stage],
            [F.CURRENT]: approverText(rec, stage, tierKey)
        });
        if (historyText) values[F.HISTORY] = (history ? history + '\n' : '') + historyLine(historyText);

        if (def.currRole) {
            const roleId = CONFIG.ROLES[def.currRole];
            if (roleId) values[F.CURR_ROLE] = roleId;
            else log.error('PO Approval', `CONFIG.ROLES.${def.currRole} not set - Current Role not updated`);
        }

        record.submitFields({
            type: record.Type.PURCHASE_ORDER,
            id: rec.id,
            values,
            options: { enableSourcing: false, ignoreMandatoryFields: true }
        });

        try {
            sendStageEmails(rec, def.emails);
        } catch (e) {
            log.error({ title: `PO ${rec.id} email failed (${stage})`, details: e });
        }

        log.audit('PO Approval', `PO ${rec.id} [${tierKey}] -> ${stage}`);
    };

    /**
     * Button action coming from the Suitelet.
     * @returns {{ok:boolean, message?:string}}
     */
    const performAction = (poId, actionKey, expectedStage, ctx) => {
        const rec = record.load({ type: record.Type.PURCHASE_ORDER, id: poId });
        const state = getState(rec);
        if (!state) return { ok: false, message: 'This Purchase Order is not subject to the approval process.' };

        if (expectedStage && expectedStage !== state.stage) {
            return { ok: false, message: 'This Purchase Order has already been processed by someone else. Please reload it.' };
        }

        const action = (stageDef(state.stage, state.tier).actions || {})[actionKey];
        if (!action) return { ok: false, message: `Action "${actionKey}" is not available at this stage.` };
        if (!isAllowed(action.rule, rec, ctx)) return { ok: false, message: 'You are not allowed to perform this action.' };

        const who = `${ctx.userName || 'User ' + ctx.userId} (${roleLabel(ctx.role)})`;
        enterStage(rec, state.tier, action.to, action.set,
            `${STAGE_LABELS[state.stage]}: ${ACTION_VERBS[actionKey] || action.label} by ${who} -> ${STAGE_LABELS[action.to]}`);
        return { ok: true };
    };

    /** Workflow "Lock Record" in End State (exempt: listed docs AND exempt employee) */
    const isLocked = (rec, userId) => {
        const state = getState(rec);
        if (!state || !stageDef(state.stage, state.tier).locked) return false;
        const doc = String(rec.getValue({ fieldId: F.DOC_NUMBER }) || '').trim();
        const exempt = CONFIG.LOCK_EXEMPT_DOCS.includes(doc) &&
            asIdList(CONFIG.EMPLOYEES.LOCK_EXEMPT).includes(String(userId));
        return !exempt;
    };

    /** Verify the role the browser reports is really assigned to the employee */
    const verifyRole = (userId, roleId) => {
        if (!roleId) return null;
        const count = search.create({
            type: search.Type.EMPLOYEE,
            filters: [['internalid', 'anyof', userId], 'AND', ['role', 'anyof', roleId]]
        }).runPaged().count;
        return count > 0 ? String(roleId) : null;
    };

    return {
        CONFIG, F, S, TIERS, APPROVAL, STAGE_LABELS,
        routeTier, routeFromRecord, isEligible, getState, stageDef,
        isChecked, getAvailableActions, enterStage, performAction, isLocked, verifyRole
    };
});
