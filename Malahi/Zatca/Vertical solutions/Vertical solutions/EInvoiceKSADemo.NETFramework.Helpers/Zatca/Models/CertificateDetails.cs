using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EInvoiceKSADemo.Helpers.Zatca.Models
{
    public class InputCsrModel
    {
        public string CSR { get; set; }
        public string PrivateKey { get; set; }
    }

    public class CertificateDetails
    {
        public string UserName { get; set; }
        public string Secret { get; set; }

        public string Certificate { get; set; }

        public string CSR { get; set; }

        public string PrivateKey { get; set; }

        public DateTime StartedDate { get; set; }

        public DateTime ExpiredDate { get; set; }
    }
}
