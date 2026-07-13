using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EInvoiceKSADemo.Helpers.Zatca.Models
{
    public class InputCSIDOnboardingModel
    {
        public string CSR { get; set; }
        public int OTP { get; set; }
        public Supplier Supplier { get; set; }
    }
    public class InputCSIDRenewingModel
    {
        public string CSR { get; set; }
        public int OTP { get; set; }
    }
    public class CSIDResultModel
    {
        /// <summary>
        /// Working as User Name (in Authentication)
        /// </summary>
        public string Certificate { get; set; }
        public string Secret { get; set; }
        public DateTime ExpiredDate { get; set; }
        public DateTime StartedDate { get; set; }
    }
}
