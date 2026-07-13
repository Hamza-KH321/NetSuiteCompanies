/*
 * Author  : Ahmed Moosa
 * Email   : ahmed_moosa83@hotmail.com
 * LinkedIn: https://www.linkedin.com/in/ahmoosa/
 * Date    : 26/9/2022
 */
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EInvoiceKSADemo.Helpers.Zatca
{
    public interface IXmlInvoiceGenerator
    {
        string GenerateInvoiceAsXml<T>(string xmlFilePath, T model) where T : class;

        string GenerateInvoiceAsXml<T>(Stream xmlStream, T model) where T : class;
    }
}
