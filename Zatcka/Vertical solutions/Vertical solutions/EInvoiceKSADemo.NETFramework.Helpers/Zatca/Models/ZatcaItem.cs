/*
 * Author  : Ahmed Moosa
 * Email   : ahmed_moosa83@hotmail.com
 * LinkedIn: https://www.linkedin.com/in/ahmoosa/
 * Date    : 26/9/2022
 */
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EInvoiceKSADemo.Helpers.Zatca.Models
{
    public class ZatcaItem
    {
        public ZatcaItem(string name, string value)
        {
            this.Name = name;
            this.Value = value;
        }
        public ZatcaItem(string name, string value, string nameAr)
        {
            this.Name = name;
            this.Value = value;
            this.NameAr = nameAr;
        }
        public string Name { get; set; }
        public string Value { get; set; }

        public string NameAr { set; get; }
        public List<ZatcaItem> SubItems { get; set; } = new List<ZatcaItem>();
    }
}
