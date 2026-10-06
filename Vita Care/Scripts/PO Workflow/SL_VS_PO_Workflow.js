/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * PO Approval - performs a button action (submit / approve / reject / resubmit / integrate)
 * and redirects back to the Purchase Order.
 *
 * Script ID:     customscript_vs_sl_po_approval
 * Deployment ID: customdeploy_vs_sl_po_approval
 * Execute As Role = Administrator (approvers may not have edit rights on POs).
 * Permission is checked against the user's own role, which is verified to be
 * assigned to the employee, so it does not depend on the execute-as role.
 */
define(['N/runtime', 'N/redirect', 'N/record', 'N/url', 'N/log', './LIB_VS_PO_Workflow'],
    (runtime, redirect, record, url, log, lib) => {

    const escapeHtml = (s) => String(s).replace(/[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const writeMessage = (context, message, poId) => {
        const back = poId
            ? url.resolveRecord({ recordType: record.Type.PURCHASE_ORDER, recordId: poId })
            : 'javascript:history.back()';
        context.response.write(
            '<html><body style="font-family:Arial,sans-serif;padding:24px">' +
            `<h3>PO Approval</h3><p>${escapeHtml(message)}</p>` +
            `<p><a href="${back}">Back to Purchase Order</a></p>` +
            '</body></html>'
        );
    };

    const onRequest = (context) => {
        const p = context.request.parameters;
        const poId = p.poid;

        try {
            if (!poId || !p.action) return writeMessage(context, 'Missing parameters.', poId);

            const user = runtime.getCurrentUser();
            const role = lib.verifyRole(user.id, p.role);
            if (!role) return writeMessage(context, 'Your role could not be verified.', poId);

            const result = lib.performAction(poId, p.action, p.stage, { userId: user.id, userName: user.name, role });
            if (!result.ok) return writeMessage(context, result.message, poId);

            redirect.toRecord({ type: record.Type.PURCHASE_ORDER, id: poId });
        } catch (e) {
            log.error({ title: `PO Approval action failed (PO ${poId}, ${p.action})`, details: e });
            writeMessage(context, `Error: ${e.message || e}`, poId);
        }
    };

    return { onRequest };
});
