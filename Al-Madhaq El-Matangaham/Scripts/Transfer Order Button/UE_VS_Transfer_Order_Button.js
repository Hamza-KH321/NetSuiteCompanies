/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @fileName UE || Transfer Order Button
 */
define(['N/log', 'N/url', 'N/runtime'], function (log, url, runtime) {

    function beforeLoad(context) {
        try {
            log.debug('beforeLoad', 'Triggered');

            if (context.type !== context.UserEventType.VIEW) {
                log.debug('Exit', 'Not view mode');
                return;
            }

            var form = context.form;
            var record = context.newRecord;

            var approvalStatus = record.getValue({ fieldId: 'approvalstatus' });
            var status = record.getValue({ fieldId: 'status' });

            log.debug('Approval Status', approvalStatus);

            // Show button only if Approved (2)
            if (approvalStatus !== '2' || status == 'Closed') {
                log.debug('Exit', 'Requisition not approved');
                return;
            }

            var currentUser = runtime.getCurrentUser();
            var currentUserRole = currentUser.role;

            log.debug('Current Role', currentUserRole);

            // Allow if creator OR role = 19 Warehouse Manager Role
            if (currentUserRole != (19,3)) {
                log.debug('Exit', 'User role must be 19 or 3, admin or warhouse manager');
                return;
            }

            var suiteletUrl = url.resolveScript({
                scriptId: 'customscript_vs_sl_transfer_order_button',
                deploymentId: 'customdeploy_vs_sl_transfer_order_button',
                params: {
                    requisitionId: record.id
                }
            });

            form.addButton({
                id: 'custpage_vs_create_to',
                label: 'Create Transfer Order',
                functionName: "window.open('" + suiteletUrl + "', '_self')"
            });

            log.debug('Button Added', suiteletUrl);

        } catch (e) {
            log.error('beforeLoad Error', e);
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
