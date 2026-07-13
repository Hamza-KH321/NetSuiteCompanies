/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/log', 'N/search'], function (log, search) {

    function beforeSubmit(context) {
        try {
            if (context.type !== context.UserEventType.CREATE) return;

            var rec = context.newRecord;

            var salesRepId = rec.getValue({ fieldId: 'salesrep' });
            rec.setValue({ fieldId: 'isinactive', value: true });

            if (salesRepId) {
                var emp = search.lookupFields({
                    type: 'employee',
                    id: salesRepId,
                    columns: ['supervisor', 'email']
                });

                var supervisorId = (emp.supervisor && emp.supervisor.length)
                    ? parseInt(emp.supervisor[0].value, 10)
                    : null;

                var supervisorEmail = emp.email || '';

                log.debug('Supervisor Lookup', { supervisorId: supervisorId, supervisorEmail: supervisorEmail });

                rec.setValue({ fieldId: 'custentity_vs_sales_manager', value: supervisorId });
                rec.setValue({ fieldId: 'custentity_vs_sales_manager_email', value: supervisorEmail });
            } else {
                rec.setValue({ fieldId: 'custentity_vs_sales_manager', value: null });
                rec.setValue({ fieldId: 'custentity_vs_sales_manager_email', value: '' });
            }

            var regionId = rec.getValue({ fieldId: 'custentitycus_reg_id_001' });

            var arEmployeeId = null;
            var arEmail = '';

            switch (String(regionId || '')) {
                // Western (3) & Northwest (7) -> Mamdouh (66004)
                case '3':
                case '7':
                    arEmployeeId = 66004;
                    arEmail = 'mamdouh.alsayid@vitacareonline.com';
                    break;

                // Central (5), Northeast (6), Eastern (2) -> Nafea (187285)
                case '5':
                case '6':
                case '2':
                    arEmployeeId = 187285;
                    arEmail = 'nafea.alsalamah@vitacareonline.com';
                    break;

                // Southern (8) -> Abdullah (450826)
                case '8':
                    arEmployeeId = 450826;
                    arEmail = 'abdullah.dalbouh@vitacareonline.com';
                    break;

                // Northern (1) or anything unspecified -> clear
                default:
                    arEmployeeId = null;
                    arEmail = '';
            }

            log.debug('Region → AR Mapping', { regionId: regionId, arEmployeeId: arEmployeeId, arEmail: arEmail });

            rec.setValue({ fieldId: 'custentity_vs_ar_manager', value: arEmployeeId });
            rec.setValue({ fieldId: 'custentity_vs_ar_manager_email', value: arEmail });

        } catch (e) {
            log.error('Error in beforeSubmit', e);
        }
    }

    return { beforeSubmit: beforeSubmit };
});
