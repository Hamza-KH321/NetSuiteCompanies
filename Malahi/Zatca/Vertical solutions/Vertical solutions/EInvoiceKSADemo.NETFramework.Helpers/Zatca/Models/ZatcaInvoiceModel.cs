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

namespace EInvoiceKSADemo.Helpers.Models
{
    public class ZatcaInvoiceReportResult : ZatcaInvoiceResult
    {
        public InvoiceModelResult ReportResult { get; set; }
    }
    public class ZatcaInvoiceResult
    {
        public ZatcaInvoiceModel Data { get; set; }
        public bool Success { get; set; }
        public string Message { get; set; }
    }
    public class ZatcaInvoiceModel
    {
        public string InvoiceHash { get; set; }
        public string QrCode { get; set; }
        public string SignedXml { get; set; }
        public string ReportingStatus { get; set; }
        public string ReportingResult { get; set; }
        public bool IsReportedToZatca { get; set; }
        public DateTime SubmissionDate { get; set; }

        public List<ValidationResultMessage> WarningMessages { get; set; }
        public List<ValidationResultMessage> ErrorMessages { get; set; }

        public string InvoiceBase64 { get; set; }
    }
}
