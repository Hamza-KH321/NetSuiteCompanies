/*
 * Author  : Ahmed Moosa
 * Email   : ahmed_moosa83@hotmail.com
 * LinkedIn: https://www.linkedin.com/in/ahmoosa/
 * Date    : 26/9/2022
 */
using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using System.Threading.Tasks;

namespace EInvoiceKSADemo.Helpers.Zatca
{
    public class SharedData
    {
        public static string UserName { get; set; }
        public static string Secret { get; set; }
        public static string APIUrl { get; set; }
    }
}
