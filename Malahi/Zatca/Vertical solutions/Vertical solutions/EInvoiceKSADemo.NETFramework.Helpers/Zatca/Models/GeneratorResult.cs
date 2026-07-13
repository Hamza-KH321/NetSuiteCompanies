using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EInvoiceKSADemo.Helpers.Zatca.Models
{
    public class GeneratorResult
    {
        public string ResultValue { get; set; }

        public bool Success { get; set; }

        public string ErrorMessage { get; set; }

        public static GeneratorResult Error(string message)
        {
            return new GeneratorResult() { ErrorMessage = message, Success = false };
        }

        public static GeneratorResult Succeeded(string result)
        {
            return new GeneratorResult() { ResultValue = result, Success = true };
        }
    }
}
