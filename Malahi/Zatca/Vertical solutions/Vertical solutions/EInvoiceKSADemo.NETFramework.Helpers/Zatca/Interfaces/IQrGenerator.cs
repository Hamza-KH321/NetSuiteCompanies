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
    public interface IQrGenerator
    {
        string Generate(string sellerName, string vatRegistrationNumber, string timeStamp, string invoiceTotal, string vatTotal, string hashedXml, byte[] publicKey, string digitalSignature, bool isSimplified, byte[] certificateSignature);
    }
}
