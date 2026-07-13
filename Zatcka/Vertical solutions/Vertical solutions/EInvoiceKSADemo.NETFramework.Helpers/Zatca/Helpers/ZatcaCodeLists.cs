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

namespace EInvoiceKSADemo.Helpers.Zatca.Helpers
{
    public class ZatcaCodeLists
    {
        public static List<ZatcaItem> SellerIdentities
        {
            get
            {
                return new List<ZatcaItem>()
                {
                    new ZatcaItem("Commercial Registration Number","CRN"),
                    new ZatcaItem("Momra License","MOM"),
                    new ZatcaItem("MLSD License","MLS"),
                    new ZatcaItem("700 Number","700"),
                    new ZatcaItem("Sagia License","SAG"),
                    new ZatcaItem("Other ID","OTH"),
                };
            }
        }

        public static List<ZatcaItem> CustomerIdentities
        {
            get
            {
                return new List<ZatcaItem>()
                {
                    new ZatcaItem("Tax Identification Number","TIN"),
                    new ZatcaItem("Commercial Registration Number","CRN"),
                    new ZatcaItem("Momra License","MOM"),
                    new ZatcaItem("MLSD License","MLS"),
                    new ZatcaItem("700 Number","700"),
                    new ZatcaItem("Sagia License","SAG"),
                    new ZatcaItem("National Id","NAT"),
                    new ZatcaItem("GCC ID","GCC"),
                    new ZatcaItem("Iqama","IQA"),
                    new ZatcaItem("Passport No","PAS"),
                    new ZatcaItem("Other ID","OTH"),
                };
            }
        }

        public static List<ZatcaItem> CreditDebitNotes
        {
            get
            {
                return new List<ZatcaItem>()
                {
                    new ZatcaItem("Cancellation or suspension of the supplies after its occurrence either wholly or partially",""),
                    new ZatcaItem("In case of essential change or amendment in the supply, which leads to the change of the VAT due",""),
                    new ZatcaItem("Amendment of the supply value which is pre-agreed upon between the supplier and consumer",""),
                    new ZatcaItem("In case of goods or services refund",""),
                    new ZatcaItem("In case of change in Seller's or Buyer's information","")
                };
            }
        }


        public static List<ZatcaItem> PaymentMeans
        {
            get
            {
                return new List<ZatcaItem>()
                {
                    new ZatcaItem("In Cash","10"),
                    new ZatcaItem("Credit","30"),
                    new ZatcaItem("Payment to Bank Account","42"),
                    new ZatcaItem("Bank Card","48"),
                    new ZatcaItem("Instrument Not Defined","1"),
                };
            }
        }

        public static List<ZatcaItem> VatCategories
        {
            get
            {
                return new List<ZatcaItem>()
                {
                    new ZatcaItem("Exempt from VAT", "E")
                    {
                        SubItems = new List<ZatcaItem>()
                        {
                            new ZatcaItem ("VATEX-SA-29", "Financial services","الخدمات المالية"),
                            new ZatcaItem ("VATEX-SA-29-7", "Life insurance services","عقد تأمين على الحياة"),
                            new ZatcaItem ("VATEX-SA-30", "Real estate transactions", "التوريدات العقارية المعفاة من الضريبة"),
                        }
                    },
                    new ZatcaItem("Standard rate","S"),
                    new ZatcaItem("Zero rated goods", "Z")
                    {
                        SubItems = new List<ZatcaItem>
                        {
                            new ZatcaItem ("VATEX-SA-32","Export of goods","صادرات السلع من المملكة"),
                            new ZatcaItem ("VATEX-SA-33","Export of services","صادرات الخدمات من المملكة"),
                            new ZatcaItem ("VATEX-SA-34-1","The international transport of Goods","النقل الدولي للسلع"),
                            new ZatcaItem ("VATEX-SA-34-2","International transport of passengers","النقل الدولي للركاب"),
                            new ZatcaItem ("VATEX-SA-34-3","services directly connected and incidental to a Supply of international passenger transport","الخدمات المرتبطة مباشرة أو عرضيًا بتوريد النقل الدولي للركاب"),
                            new ZatcaItem ("VATEX-SA-34-4","Supply of a qualifying means of  transport","توريد وسائل النقل المؤهلة"),
                            new ZatcaItem ("VATEX-SA-34-5","Any services relating to Goods or passenger transportation","الخدمات ذات الصلة بنقل السلع أو الركاب"),
                            new ZatcaItem ("VATEX-SA-35","Medicines and medical equipment","الأدوية والمعدات الطبية"),
                            new ZatcaItem ("VATEX-SA-36","Qualifying metals","المعادن المؤهلة"),
                            new ZatcaItem ("VATEX-SA-EDU","Private education to citizen","الخدمات التعليمية الخاصة بالمواطنين"),
                            new ZatcaItem ("VATEX-SA-HEA","Private healthcare to citizen","الخدمات الصحية الخاصة بالمواطنين"),
                            new ZatcaItem ("VATEX-SA-MLTRY","supply of qualified military goods","توريد السلع العسكرية المؤهلة")
                        }
                    },
                    new ZatcaItem("Services outside scope of tax / Not subject to VAT", "O")
                    {
                        SubItems = new List<ZatcaItem>
                        {
                            new ZatcaItem ("VATEX-SA-OOS","Reason is free text, to be provided by the taxpayer on case to case basis","السبب يتم تزويده من قبل المكلف على أساس كل حالة على حدة")
                        }
                    }
                };
            }
        }
    }
}
