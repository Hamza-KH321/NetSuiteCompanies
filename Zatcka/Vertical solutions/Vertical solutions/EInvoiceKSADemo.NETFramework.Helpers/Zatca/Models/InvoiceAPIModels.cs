/*
 * Author  : Ahmed Moosa
 * Email   : ahmed_moosa83@hotmail.com
 * LinkedIn: https://www.linkedin.com/in/ahmoosa/
 * Date    : 26/9/2022
 */
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EInvoiceKSADemo.Helpers.Zatca.Models
{
    public class InvoiceModelResult
    {
        public string ClearedInvoice { get; set; }
        public ValidationResult ValidationResults { get; set; }
        public string ReportingStatus { get; set; }
        public string ClearanceStatus { get; set; }
    }

    public class ValidationResult
    {
        public List<ValidationResultMessage> InfoMessages { get; set; }
        public List<ValidationResultMessage> WarningMessages { get; set; }
        public List<ValidationResultMessage> ErrorMessages { get; set; }
        public string Status { get; set; }
    }

    public class ValidationResultMessage
    {
        public string Type { get; set; }
        public string Code { get; set; }
        public string Category { get; set; }
        public string Message { get; set; }
        public string Status { get; set; }
    }
    public class InputInvoiceModel
    {
        public string UUID { get; set; }
        public string InvoiceHash { get; set; }
        public string Invoice { get; set; }
    }

    public class InputComplianceModel
    {
        public string csr { get; set; }
    }

    public class ComplianceModelResult
    {
        public string Secret { get; set; }
        public string BinarySecurityToken { get; set; }

        public long RequestId { get; set; }

        public string Errors { get; set; }
        public string DispositionMessage { get; set; }
    }

    public class InputCSIDModel
    {
        public string compliance_request_id { get; set; }
    }
}
