
using EInvoiceKSADemo.Helpers.Zatca;
using EInvoiceKSADemo.Helpers.Zatca.Helpers;
using EInvoiceKSADemo.Helpers.Zatca.Models;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace EInvoiceKSADemo.NETFramework.Test
{
    public partial class Form1 : Form
    {
        private readonly IZatcaReporter _reporter;
        public Form1()
        {
            //var config = new MyCertificateConfiguration();
            _reporter = new ZatcaReporter();
            InitializeComponent();
        }

        private async void button1_Click(object sender, EventArgs e)
        {
            var certificateDetails = new CertificateConfiguration().GetCertificateDetails();
            if (certificateDetails != null)
            {
                SharedData.UserName = certificateDetails.UserName;
                SharedData.Secret = certificateDetails.Secret;
            }

            var reportResult = await _reporter.ReportInvoiceAsync(new InvoiceDataModel
            {
                InvoiceNumber = GetNextInvoiceNumber(),
                InvoiceTypeCode = (int)InvoiceTypeCode.Credit,
                Id = Guid.NewGuid().ToString(),
                Order = 2,
                TransactionTypeCode = TransactionTypeCode.Simplified,
                Tax = 15,
                Lines = new List<LineItem>
                {
                    new LineItem {  Index =  1, ProductName = "Gold X", Quantity = 21, NetPrice = 236042.1, Tax = 15.00 },
                    new LineItem {  Index = 3, ProductName = "Service Name" , Quantity = 1, NetPrice = 200.45 ,Tax = 15.00 },
                    new LineItem {  LineDiscount = 5, Index = 1, ProductName = "T-Shirt" , Quantity = 2, NetPrice = 200.45 ,Tax = 15.00 },
                    new LineItem {  LineDiscount = 50, Index = 2, ProductName = "LCD Screen" , Quantity = 2, NetPrice = 2499.99,Tax = 15.00},
                    new LineItem {  LineDiscount = 10, Index = 3, ProductName = "Galaxy Note" , Quantity = 10, NetPrice = 1000,Tax = 0,
                        TaxCategory = "Z" , TaxCategoryReason = "Export of goods", TaxCategoryReasonCode = "VATEX-SA-32"},

                    new LineItem {  Index = 4, ProductName = "Gold" , Quantity = 0.3 , NetPrice = 579.71 ,Tax = 15.00 },

                    new LineItem {  Index = 5, ProductName = "AL/XLPE/STA/PVC" , Quantity = 1.004, NetPrice = 58882.8 ,Tax = 15.00 },
                    new LineItem {  Index = 6, ProductName = "CU/XLPE/SWA/PVC" , Quantity = 1.908, NetPrice = 16157.12 ,Tax = 15.00 },

                    new LineItem{  PriceDiscount = 1, LineDiscount = 20 ,  Index = 7,  ProductName = "Boxes", NetPrice = 10 , Quantity  = 102 , Tax = 15.00 },

                    new LineItem { Index = 8,  NetPrice = 108.70 , ProductName = "test api" , Quantity =  1 , Tax = 15.00}
                },
                Discount = 20,
                PaymentMeansCode = 10,
                Supplier = new Supplier
                {
                    SellerName = "Acme Widget’s LTD 2",
                    SellerTRN = "300075588700003",
                    AdditionalStreetAddress = "2223",
                    BuildingNumber = "2322",
                    CityName = "Riyadh",
                    IdentityNumber = "311111111111113",
                    IdentityType = "CRN",
                    CountryCode = "SA",
                    DistrictName = "Olia",
                    PostalCode = "23333",
                    StreetName = "الامير سلطان",
                },
                Customer = new Customer
                {
                    CustomerName = "Saleh Saleh",
                    IdentityNumber = "311111111111113",
                    IdentityType = "NAT",
                    VatRegNumber = "323042342342333",
                    StreetName = "Makka",
                    BuildingNumber = "1111",
                    ZipCode = "12345",
                    CityName = "Al Riyadh",
                    DistrictName = "Al Olia",
                    RegionName = "Al Riyadh"
                },
                IssueDate = DateTime.Now.ToString("yyyy-MM-dd"),// "2022-09-26",
                IssueTime = DateTime.Now.ToString("HH:mm:ssZ"), // "17:00:00Z",
                PreviousInvoiceHash = GetPreviousInvoiceHash(),
                Notes = "Cancellation or suspension of the supplies after its occurrence either wholly or partially",
                ReferenceId = "INV/2022/9/26/1",
                DeliveryDate = DateTime.Now.ToString("yyyy-MM-dd")
            });

            if (reportResult.Success)
            {
                label1.Text = "Status : " + reportResult.Data?.ReportingStatus + " -  Warning " + reportResult.Data?.WarningMessages.Count;
            }
            else
            {
                MessageBox.Show(ZatcaHttpClient.LastErrorMessage);
            }
        }

        private string GetPreviousInvoiceHash()
        {
            return "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==";
        }

        private string GetNextInvoiceNumber()
        {
            return "INV/2022/9/26/2";
        }

        private void button2_Click(object sender, EventArgs e)
        {
            OnboardingForm form = new OnboardingForm();
            form.ShowDialog();
        }

        private void invoiceGeneratorBtn_Click(object sender, EventArgs e)
        {
            GenertorInfoForm form = new GenertorInfoForm();
            form.Show();
        }

        private void Form1_Load(object sender, EventArgs e)
        {
        }

        private List<LineItem> GetFoodLines()
        {
            return new List<LineItem>
            {
                    new  LineItem{ Index = 8 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 67, Quantity = 1, Tax = 15.00 },
                    new LineItem {  Index = 9, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 2, NetPrice = 170 ,Tax = 15.00 },
                    new LineItem {  Index = 10, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 1, NetPrice = 97.5 ,Tax = 15.00 },
                    new LineItem {  Index = 11, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 1, NetPrice = 97.5 ,Tax = 15.00 },
                    new LineItem {  Index = 12, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 10, NetPrice = 15.5 ,Tax = 15.00 },
                    new LineItem {  Index = 13, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 10, NetPrice = 16.09 ,Tax = 15.00 },
                    new LineItem {  Index = 14, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 1, NetPrice = 120,Tax = 15.00 },
                    new LineItem {  Index = 15, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 1, NetPrice = 146,Tax = 15.00 },
                    new LineItem {  Index = 16, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 1, NetPrice = 131,Tax = 15.00 },
                    new LineItem {  Index = 17, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 1, NetPrice = 89,Tax = 15.00 },
                    new LineItem {  Index = 18, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 1, NetPrice = 239,Tax = 15.00 },
                    new LineItem {  Index = 19, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 1, NetPrice = 58.5,Tax = 15.00 },
                    new LineItem {  Index = 20, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 3, NetPrice = 58.5,Tax = 15.00 },
                    new LineItem {  Index = 21, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 3, NetPrice = 56.5,Tax = 15.00 },
                    new LineItem {  Index = 22, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 1, NetPrice = 89,Tax = 15.00 },

                    new LineItem {  Index = 23, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 5, NetPrice = 5.869,Tax = 15.00 },

                    new LineItem {  Index = 24, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 1, NetPrice = 338,Tax = 15.00 },
                    new LineItem {  Index = 25, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 1, NetPrice = 171,Tax = 15.00 },
                    new LineItem {  Index = 26, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 2, NetPrice = 51.5,Tax = 15.00 },
                    new LineItem {  Index = 27, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 2, NetPrice = 17.5,Tax = 15.00 },
                    new LineItem {  Index = 28, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 5, NetPrice = 61.5,Tax = 15.00 },

                    new LineItem {  Index = 29, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 2, NetPrice = 90,Tax = 15.00 },
                    new LineItem {  Index = 30, ProductName = "زيت تنك عربي قلي* 17 لتر" , Quantity = 2, NetPrice = 62.5,Tax = 15.00 },


                    // //Invoice 1
                new  LineItem{ Index = 37 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 46.5, Quantity = 8, Tax = 15.00 },
                new  LineItem{ Index = 38 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 46.5, Quantity = 4, Tax = 15.00 },
                new  LineItem{ Index = 39 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 46.5, Quantity = 2, Tax = 15.00 },
                new  LineItem{ Index = 40 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 46.5, Quantity = 2, Tax = 15.00 },
                new  LineItem{ Index = 41 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 46.5, Quantity = 2, Tax = 15.00 },
                new  LineItem{ Index = 42 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 46.5, Quantity = 2, Tax = 15.00 },

                new  LineItem{ Index = 43 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 46.521, Quantity = 1, Tax = 15.00 },
                new  LineItem{ Index = 44 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 46.956, Quantity = 1, Tax = 15.00 },
                new  LineItem{ Index = 45 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 13.5, Quantity = 4, Tax = 15.00 },
                new  LineItem{ Index = 46 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 8.478, Quantity = 2, Tax = 15.00 },


                   //Invoice 2
                new  LineItem{ Index = 31 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 47.826, Quantity = 1, Tax = 15.00 },
                new  LineItem{ Index = 32 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 53, Quantity = 1, Tax = 15.00 },
                new  LineItem{ Index = 33 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 55.5, Quantity = 1, Tax = 15.00 },
                new  LineItem{ Index = 34 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 48.5, Quantity = 1, Tax = 15.00 },
                new  LineItem{ Index = 35 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 39.75, Quantity = 1, Tax = 15.00 },
                new  LineItem{ Index = 36 , ProductName = "كتشب رنا عريض كبيرجدا4.5غم*4جا" , NetPrice = 56.09, Quantity = 1, Tax = 15.00 },
            };
        }

        private void button3_Click(object sender, EventArgs e)
        {
            CsrForm form = new CsrForm();
            form.ShowDialog();
        }
    }
}
