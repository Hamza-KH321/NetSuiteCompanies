/*
 * Author  : Ahmed Moosa
 * Email   : ahmed_moosa83@hotmail.com
 * LinkedIn: https://www.linkedin.com/in/ahmoosa/
 * Date    : 26/9/2022
 */
using EInvoiceKSADemo.Helpers.Zatca.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EInvoiceKSADemo.Helpers.Zatca
{
    public interface IZatcaAPICaller
    {
        Task<ComplianceModelResult> CompleteComplianceCSIDAsync(InputComplianceModel model, int otp);

        Task<InvoiceModelResult> PerformComplianceCheckAsync(InputInvoiceModel model);

        Task<InvoiceModelResult> ReportSingleInvoiceAsync(InputInvoiceModel model, int clearanceStatus);

        Task<InvoiceModelResult> ClearSingleInvoiceAsync(InputInvoiceModel model, int clearanceStatus);

        Task<ComplianceModelResult> OnboardingCSIDAsync(InputCSIDModel model);

        Task<ComplianceModelResult> RenewalCSIDAsync(InputComplianceModel model, int otp);
    }
}
