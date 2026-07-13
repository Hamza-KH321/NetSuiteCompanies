using EInvoiceKSADemo.Helpers.Zatca;
using EInvoiceKSADemo.Helpers.Zatca.Helpers;
using EInvoiceKSADemo.Helpers.Zatca.Interfaces;
using EInvoiceKSADemo.Helpers.Zatca.Models;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using ZXing;
using ZXing.Common;

namespace EInvoiceKSADemo
{
    public partial class GenertorInfoForm : Form
    {
        private readonly IInvoiceInfoGenerator _invoiceInfoGenerator;
        public GenertorInfoForm()
        {
            InitializeComponent();
            this._invoiceInfoGenerator = new InvoiceInfoGenerator();
        }

        private void generateXmlBtn_Click(object sender, EventArgs e)
        {
            var result = _invoiceInfoGenerator.GenerateXmlBeforeSigning(new InvoiceDataModel
            {
                InvoiceNumber = GetNextInvoiceNumber(),
                InvoiceTypeCode = (int)InvoiceTypeCode.Invoice,
                Id = Guid.NewGuid().ToString(),
                Order = 2,
                TransactionTypeCode = TransactionTypeCode.Standard,
                Tax = 15,
                Lines = new List<LineItem>
                {
                    new LineItem {  LineDiscount = 20, Index = 1, ProductName = "Boxes" , Quantity = 102, NetPrice = 10 ,Tax = 15.00 },
                    new LineItem {  LineDiscount = 5, Index = 1, ProductName = "T-Shirt" , Quantity = 2, NetPrice = 200.45 ,Tax = 15.00 },
                    new LineItem {  LineDiscount = 50, Index = 2, ProductName = "LCD Screen" , Quantity = 2, NetPrice = 2499.99,Tax = 15.00},
                    new LineItem {  LineDiscount = 10, Index = 3, ProductName = "Galaxy Note" , Quantity = 10, NetPrice = 1000,Tax = 0, TaxCategory = "Z"},
                    new LineItem {  Index = 4, ProductName = "Gold" , Quantity = 0.3 , NetPrice = 579.71 ,Tax = 15.00 },
                    new LineItem {  Index = 5, ProductName = "AL/XLPE/STA/PVC" , Quantity = 1.004, NetPrice = 58882.8 ,Tax = 15.00 },
                    new LineItem {  Index = 6, ProductName = "CU/XLPE/SWA/PVC" , Quantity = 1.908, NetPrice = 16157.12 ,Tax = 15.00 },
                },
                //Discount = 50,
                PaymentMeansCode = 10,
                Supplier = new Supplier
                {
                    SellerName = "Test Company",
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
                IssueDate = "2022-09-26",
                IssueTime = "17:00:00",
                PreviousInvoiceHash = GetPreviousInvoiceHash(),
                //Notes = "Cancellation or suspension of the supplies after its occurrence either wholly or partially",
                //ReferenceId = "INV/2022/9/26/1"
            });

            if (result.Success)
            {
                xmlRichTextBox.Text = result.ResultValue;
            }
            else
            {
                MessageBox.Show(result.ErrorMessage);
            }
        }

        private string GetPreviousInvoiceHash()
        {
            // Select Top (1) * from invoices order by SubmissionDate
            // _context.invoices.OrderByDescending(i=> i.SubmissionDate).FirstOrDefault();
            return "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==";
        }

        private string GetNextInvoiceNumber()
        {
            return "INV/2022/9/26/2";
        }

        private void generateQrCodeBtn_Click(object sender, EventArgs e)
        {
            var result = _invoiceInfoGenerator.GenerateQrCode(new InvoiceDataModel
            {
                InvoiceNumber = GetNextInvoiceNumber(),
                InvoiceTypeCode = (int)InvoiceTypeCode.Invoice,
                Id = Guid.NewGuid().ToString(),
                Order = 2,
                TransactionTypeCode = TransactionTypeCode.Standard,
                Tax = 15,
                Lines = new List<LineItem>
                {
                    new LineItem {  LineDiscount = 20, Index = 1, ProductName = "Boxes" , Quantity = 102, NetPrice = 10 ,Tax = 15.00 },
                    new LineItem {  LineDiscount = 5, Index = 1, ProductName = "T-Shirt" , Quantity = 2, NetPrice = 200.45 ,Tax = 15.00 },
                    new LineItem {  LineDiscount = 50, Index = 2, ProductName = "LCD Screen" , Quantity = 2, NetPrice = 2499.99,Tax = 15.00},
                    new LineItem {  LineDiscount = 10, Index = 3, ProductName = "Galaxy Note" , Quantity = 10, NetPrice = 1000,Tax = 0, TaxCategory = "Z"},
                    new LineItem {  Index = 4, ProductName = "Gold" , Quantity = 0.3 , NetPrice = 579.71 ,Tax = 15.00 },
                    new LineItem {  Index = 5, ProductName = "AL/XLPE/STA/PVC" , Quantity = 1.004, NetPrice = 58882.8 ,Tax = 15.00 },
                    new LineItem {  Index = 6, ProductName = "CU/XLPE/SWA/PVC" , Quantity = 1.908, NetPrice = 16157.12 ,Tax = 15.00 },
                },
                //Discount = 50,
                PaymentMeansCode = 10,
                Supplier = new Supplier
                {
                    SellerName = "Test Company",
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
                IssueDate = "2022-09-26",
                IssueTime = "17:00:00",
                PreviousInvoiceHash = GetPreviousInvoiceHash(),
                //Notes = "Cancellation or suspension of the supplies after its occurrence either wholly or partially",
                //ReferenceId = "INV/2022/9/26/1"
            });

            if (result.Success)
            {
                QrRichTextBox.Text = result.ResultValue;
                pictureBox1.Image = LoadImage(result.ResultValue);
            }
            else
            {
                MessageBox.Show(result.ErrorMessage);
            }
        }

        public Image LoadImage(string qrCode)
        {
            byte[] bytes = Convert.FromBase64String(ConvertQrCodeToImage(qrCode));

            Image image;
            using (MemoryStream ms = new MemoryStream(bytes))
            {
                image = Image.FromStream(ms);
            }

            return image;
        }

        private string ConvertQrCodeToImage(string qrCodeBase64)
        {
            if (!string.IsNullOrEmpty(qrCodeBase64))
            {
                var QrBitmap = toQrCode(qrCodeBase64);
                byte[] BitmapArray = GetBitmapToByteArray(QrBitmap);
                return Convert.ToBase64String(BitmapArray);
            }
            return string.Empty;
        }
        private Bitmap toQrCode(string qrCodeBase64, int width = 217, int height = 197)
        {
            var barcodeWriter = new BarcodeWriter
            {
                Format = BarcodeFormat.QR_CODE,
                Options = new EncodingOptions
                {
                    Width = width,
                    Height = height
                }
            };
            Bitmap QrCode = barcodeWriter.Write(qrCodeBase64);

            return QrCode;
        }
        private byte[] GetBitmapToByteArray(Bitmap bitmap)
        {
            using (MemoryStream ms = new MemoryStream())
            {
                bitmap.Save(ms, ImageFormat.Png);
                return ms.ToArray();
            }
        }
    }
}
