using System.Collections.Generic;
using System.Linq;

namespace EInvoiceKSADemo.Helpers.Zatca.Models
{
    public class ZatcaResult
    {
        public ZatcaResult()
        {
            StepType = StepType.Unknown;
        }
        public StepType StepType { get; set; }

        public bool IsValid { get; set; }

        public string ErrorMessage { get; set; }

        public string ResultValue { get; set; }

        public List<ZatcaResult> Steps { get; set; }

        public string SingedXML { get; set; }
        public string UUID { get; internal set; }
        public bool IsSimplified { get; set; }

        public string InvoiceAsBase64
        {
            get
            {
                return this.Steps.FirstOrDefault(s => s.IsValid && s.StepType == StepType.InvoiceBase64)?.ResultValue;
            }
        }

        public string InvoiceHash
        {
            get
            {
                return this.Steps.FirstOrDefault(s => s.IsValid && s.StepType == StepType.InvoiceHash)?.ResultValue;
            }
        }

        public string QrCode
        {
            get
            {
                return this.Steps.FirstOrDefault(s => s.IsValid && s.StepType == StepType.QrCode)?.ResultValue;
            }
        }

        public string PreviousInvoiceHash { get; internal set; }

        public static ZatcaResult Error(string message)
        {
            return new ZatcaResult() { ErrorMessage = message };
        }

        public static ZatcaResult Success(string result = null)
        {
            return new ZatcaResult() { ResultValue = result, IsValid = true };
        }
    }

    public enum StepType
    {
        Unknown,
        InvoiceHash,
        QrCode,
        InvoiceBase64
    }
}