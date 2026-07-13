/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function (record, log) {

    function beforeSubmit(context) {
        try {
            var rec = context.newRecord;

            var businessScore = parseFloat(rec.getValue('custentity_vs_business_score')) || 0;
            var ageScore = parseFloat(rec.getValue('custentity_vs_age_score')) || 0;
            var backgroundScore = parseFloat(rec.getValue('custentity_vs_background_score')) || 0;

            var averageScore = (businessScore + ageScore + backgroundScore) / 3;
            averageScore = parseFloat(averageScore.toFixed(2));

            rec.setValue({ fieldId: 'custentity_vs_average_score', value: averageScore });

            var collateral = '';
            var creditRisk = '';

            if (averageScore >= 4.0 && averageScore <= 5.0) {
                collateral = 'N/A';
                creditRisk = 'Low';
            } else if (averageScore >= 3.0 && averageScore <= 3.49) {
                collateral = 'Promissory Note';
                creditRisk = 'Moderate';
            } else if (averageScore >= 3.5 && averageScore <= 3.99) {
                collateral = 'Personal Gurantee';
                creditRisk = 'Moderate';
            }
            else if (averageScore >= 2.0 && averageScore <= 2.99) {
                collateral = 'Bank Guarantee / LC / Manager’s cheque with at least 50% of Credit Limit amount, and remaining amount with Security cheque/Personal Guarantee';
                creditRisk = 'High';
            } else if (averageScore >= 1.0 && averageScore <= 1.99) {
                collateral = 'Bank Guarantee / LC / Manager’s cheque to cover 100% credit limit assigned';
                creditRisk = 'High';
            }

            rec.setValue({ fieldId: 'custentity_vs_mandatory_collateral_requi', value: collateral });
            rec.setValue({ fieldId: 'custentity_vs_credit_risk_rating_for_cl_', value: creditRisk });

            log.debug('Credit Risk Evaluation', {
                businessScore: businessScore,
                ageScore: ageScore,
                backgroundScore: backgroundScore,
                averageScore: averageScore,
                collateral: collateral,
                creditRisk: creditRisk
            });

        } catch (e) {
            log.error('Error in beforeSubmit', e);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
