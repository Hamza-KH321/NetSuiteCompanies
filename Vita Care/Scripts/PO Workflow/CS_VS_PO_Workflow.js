/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 *
 * PO Approval - button handler (attached by UE_VS_PO_Workflow via clientScriptModulePath).
 * No deployment needed.
 */
define(['N/url', 'N/runtime'], (url, runtime) => {

    let busy = false;

    const pageInit = () => {};

    const vsPoAction = (poId, action, stage) => {
        if (busy) return;
        if (action === 'reject' && !window.confirm('Are you sure you want to reject this Purchase Order?')) return;
        busy = true;

        window.location.href = url.resolveScript({
            scriptId: 'customscript_vs_sl_po_approval',
            deploymentId: 'customdeploy_vs_sl_po_approval',
            params: {
                poid: poId,
                action,
                stage,
                role: runtime.getCurrentUser().role
            }
        });
    };

    return { pageInit, vsPoAction };
});
