using EInvoiceKSADemo.Helpers.Zatca.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EInvoiceKSADemo.Helpers.Zatca.Interfaces
{
    public interface IInvoiceInfoGenerator
    {
        GeneratorResult GenerateXmlBeforeSigning<T>(T model) where T : class;

        GeneratorResult GenerateQrCode<T>(T model) where T : class;
    }
}
