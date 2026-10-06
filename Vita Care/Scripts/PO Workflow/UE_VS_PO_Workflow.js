/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * PO Approval - User Event (Purchase Order)
 *  beforeLoad  : approval buttons (view mode) + End State record lock
 *  afterSubmit : start approval on create (new POs only), Parent SO auto-approve,
 *                "Total Re-Check" re-routing, End State re-assert (tier 2)
 *
 * Deployment: Purchase Order, Execute As Role = Current Role
 * (so beforeLoad sees the user's real role when deciding which buttons to show).
 */
define(['N/record', 'N/runtime', 'N/error', 'N/log', './LIB_VS_PO_Workflow'],
    (record, runtime, error, log, lib) => {

    const { F, S, TIERS, APPROVAL } = lib;

    const beforeLoad = (context) => {
        if (runtime.executionContext !== runtime.ContextType.USER_INTERFACE) return;

        const rec = context.newRecord;
        if (!rec.id) return;

        const T = context.UserEventType;
        const user = runtime.getCurrentUser();

        // ---- Lock Record (End State) ------------------------------------
        if (lib.isLocked(rec, user.id)) {
            if (context.type === T.EDIT) {
                throw error.create({
                    name: 'VS_PO_LOCKED',
                    message: 'This Purchase Order has been approved and sent to integration. It is locked for editing.',
                    notifyOff: true
                });
            }
            if (context.type === T.VIEW) {
                try { context.form.removeButton({ id: 'edit' }); } catch (e) { /* button may not exist */ }
            }
        }

        // ---- Approval buttons (view mode) -------------------------------
        if (context.type !== T.VIEW) return;

        const actions = lib.getAvailableActions(rec, { userId: user.id, role: user.role });
        if (!actions.length) return;

        context.form.clientScriptModulePath = './CS_VS_PO_Workflow.js';
        actions.forEach((a) => {
            context.form.addButton({
                id: `custpage_vs_po_${a.key}`,
                label: a.label,
                functionName: `vsPoAction(${rec.id}, '${a.key}', '${a.stage}')`
            });
        });
    };

    const afterSubmit = (context) => {
        const T = context.UserEventType;
        if (context.type !== T.CREATE && context.type !== T.EDIT) return;

        try {
            const rec = record.load({ type: record.Type.PURCHASE_ORDER, id: context.newRecord.id });
            const user = runtime.getCurrentUser();
            const by = user.name || `User ${user.id}`;

            const isParentApproved = () =>
                Number(rec.getValue({ fieldId: F.APPROVAL_STATUS })) === APPROVAL.APPROVED &&
                !!rec.getValue({ fieldId: F.PARENT_SO });

            // ---- Start approval: new POs only (old transactions are never picked up)
            if (context.type === T.CREATE) {
                if (!lib.isEligible(rec)) return;
                const tier = lib.routeFromRecord(rec);
                const label = lib.TIERS[tier].label;
                if (isParentApproved()) {
                    lib.enterStage(rec, tier, S.APPROVED, null,
                        `Approval started (${label}) by ${by} - auto-approved (created from Sales Order) -> ${lib.STAGE_LABELS[S.APPROVED]}`);
                } else {
                    lib.enterStage(rec, tier, S.INITIAL, null,
                        `Approval started (${label}) by ${by} -> ${lib.STAGE_LABELS[S.INITIAL]}`);
                }
                return;
            }

            // ---- EDIT: only POs already in the script approval process
            const state = lib.getState(rec);
            if (!state) return;

            if (state.stage === S.INITIAL && isParentApproved()) {
                lib.enterStage(rec, state.tier, S.APPROVED, null,
                    `Auto-approved (created from Sales Order) -> ${lib.STAGE_LABELS[S.APPROVED]}`);
                return;
            }

            // ---- Total Re-Check
            if (TIERS[state.tier].recheck.includes(state.stage)) {
                const oldTotal = context.oldRecord.getValue({ fieldId: 'total' });
                const newTotal = rec.getValue({ fieldId: 'total' });
                const oldEmpty = oldTotal === '' || oldTotal === null;
                const newEmpty = newTotal === '' || newTotal === null;

                const changed = oldEmpty ? !newEmpty : (newEmpty || Number(oldTotal) !== Number(newTotal));
                const oldNotZero = oldEmpty || Number(oldTotal) !== 0;
                const flagOff = !lib.isChecked(rec.getValue({ fieldId: F.TOTAL_CHANGED_WF }));

                if (changed && oldNotZero && flagOff) {
                    const newTier = lib.routeFromRecord(rec);
                    lib.enterStage(rec, newTier, S.INITIAL, { [F.TOTAL_CHANGED_WF]: true },
                        `${lib.STAGE_LABELS[state.stage]}: Total changed ${oldTotal} -> ${newTotal} by ${by}, ` +
                        `re-routed ${state.tier} -> ${newTier} -> ${lib.STAGE_LABELS[S.INITIAL]}`);
                    return;
                }
            }

            // ---- End State re-assert (tier 2 workflow had this on afterSubmit)
            if (state.stage === S.END && state.tier === 'T2' &&
                (Number(rec.getValue({ fieldId: F.APPROVAL_STATUS })) !== APPROVAL.APPROVED ||
                 !lib.isChecked(rec.getValue({ fieldId: F.SEND_TO_INT })))) {
                record.submitFields({
                    type: record.Type.PURCHASE_ORDER,
                    id: rec.id,
                    values: { [F.APPROVAL_STATUS]: APPROVAL.APPROVED, [F.SEND_TO_INT]: true },
                    options: { enableSourcing: false, ignoreMandatoryFields: true }
                });
            }
        } catch (e) {
            log.error({ title: `PO Approval afterSubmit failed (PO ${context.newRecord.id})`, details: e });
        }
    };

    return { beforeLoad, afterSubmit };
});
