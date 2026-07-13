using EInvoiceKSADemo.Helpers.Zatca.Models;
using Org.BouncyCastle.Asn1;
using Org.BouncyCastle.Asn1.Pkcs;
using Org.BouncyCastle.Asn1.X509;
using Org.BouncyCastle.Pkcs;
using Org.BouncyCastle.Utilities.IO.Pem;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace EInvoiceKSADemo.Helpers.Zatca.Helpers
{
    public class ZatcaCsrReader : IZatcaCsrReader
    {
        public CsrInvoiceTypeRestriction GetCsrInvoiceType(string csr)
        {
            try
            {
                var isBase64 = IsBase64String(csr);

                var subjectAltName = DecodeCsr(isBase64 ? Encoding.UTF8.GetString(Convert.FromBase64String(csr)) : csr);

                var names = subjectAltName.Split(',');

                var invoiceType = names.FirstOrDefault(n => n.StartsWith("T="))?.Replace("T=", "");
                var vatRegNumber = names.FirstOrDefault(n => n.StartsWith("UID="))?.Replace("UID=", "");
                if (!string.IsNullOrEmpty(invoiceType))
                {
                    return new CsrInvoiceTypeRestriction
                    {
                        StandardAllowed = invoiceType.StartsWith("1"),
                        SimplifiedAllowed = invoiceType.StartsWith("01") || invoiceType.StartsWith("11"),
                        VatRegNumber = vatRegNumber
                    };
                }
                return null;
            }
            catch (Exception ex)
            {
                return null;
            }
        }

        private string DecodeCsr(string csr)
        {
            csr = Regex.Replace(csr, @"-----[^-]+-----", String.Empty).Trim().Replace(" ", "").Replace(Environment.NewLine, "");

            PemObject pem = new PemObject("CSR", Convert.FromBase64String(csr));
            Pkcs10CertificationRequest request = new Pkcs10CertificationRequest(pem.Content);
            CertificationRequestInfo requestInfo = request.GetCertificationRequestInfo();

            DerSequence extensionSequence = requestInfo.Attributes.OfType<DerSequence>()
                                                                  .First(o => o.OfType<DerObjectIdentifier>()
                                                                               .Any(oo => oo.Id == "1.2.840.113549.1.9.14"));
            DerSet extensionSet = extensionSequence.OfType<DerSet>().First();

            DerOctetString str = GetAsn1ObjectRecursive<DerOctetString>(extensionSet.OfType<DerSequence>().First(), "2.5.29.17");

            GeneralNames names = GeneralNames.GetInstance(Asn1Object.FromByteArray(str.GetOctets()));

            return names.GetNames().FirstOrDefault()?.Name.ToString();
        }

        private T GetAsn1ObjectRecursive<T>(DerSequence sequence, String id) where T : Asn1Object
        {
            if (sequence.OfType<DerObjectIdentifier>().Any(o => o.Id == id))
            {
                return sequence.OfType<T>().First();
            }

            foreach (DerSequence subSequence in sequence.OfType<DerSequence>())
            {
                T value = GetAsn1ObjectRecursive<T>(subSequence, id);
                if (value != default(T))
                {
                    return value;
                }
            }

            return default(T);
        }

        public bool IsBase64String(string base64)
        {
            try
            {
                Convert.FromBase64String(base64);
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }
    }
}
