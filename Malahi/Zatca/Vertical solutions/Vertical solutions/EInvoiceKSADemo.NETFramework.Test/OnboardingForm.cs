using EInvoiceKSADemo.Helpers.Zatca;
using EInvoiceKSADemo.Helpers.Zatca.Helpers;
using EInvoiceKSADemo.Helpers.Zatca.Models;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Web;
using System.Windows.Documents;
using System.Windows.Forms;

namespace EInvoiceKSADemo
{
    public partial class OnboardingForm : Form
    {
        private readonly IZatcaCSIDIssuer zatcaCSIDIssuer;
        private readonly ICertificateConfiguration _certificateConfiguration;
        private string csrFileContent;
        public OnboardingForm()
        {
            this.zatcaCSIDIssuer = new ZatcaCSIDIssuer();
            _certificateConfiguration = new CertificateConfiguration();
            InitializeComponent();
        }

        private async void button2_Click(object sender, EventArgs e)
        {
            if (!string.IsNullOrEmpty(csrFileContent))
            {
                var result = await zatcaCSIDIssuer.OnboardingCSIDAsync(new InputCSIDOnboardingModel
                {
                    CSR = Convert.ToBase64String(Encoding.UTF8.GetBytes(csrFileContent)),
                    OTP = int.Parse(otptxtbox.Text),
                    Supplier = new Supplier
                    {
                        SellerName = "Acme Widget’s LTD 2",
                        SellerTRN = "302101447400003", //"300075588700003",
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
                });

                if (result != null)
                {
                    //Save to Database (Certificate & Secret & PrivateKey & CSR & StartedDate & ExpiredDate)
                    richTextBox1.Text = result.Certificate; //CSID (Certificate & UserName)
                    secretTxt.Text = result.Secret;
                    startedDateLbl.Text = result.StartedDate.ToString();
                    expiredDateLbl.Text = result.ExpiredDate.ToString();
                }
                else
                {
                    MessageBox.Show(ZatcaHttpClient.LastErrorMessage);
                }
            }
        }

        private void uploadCsrBtn_Click(object sender, EventArgs e)
        {
            var result = openFileDialog1.ShowDialog(this);

            if (result == DialogResult.OK)
            {
                uploadedFileLbl.Text = Path.GetFileName(openFileDialog1.FileName);

                csrFileContent = File.ReadAllText(openFileDialog1.FileName);
            }
        }
        private void groupBox1_Enter(object sender, EventArgs e)
        {

        }

        private async void renewBtn_Click(object sender, EventArgs e)
        {
            if (!string.IsNullOrEmpty(csrFileContent))
            {
                var config = _certificateConfiguration.GetCertificateDetails();
                SharedData.UserName = !string.IsNullOrEmpty(richTextBox1.Text) ? richTextBox1.Text : config.UserName;
                SharedData.Secret = !string.IsNullOrEmpty(secretLbl.Text) ? secretLbl.Text : config.Secret;

                var result = await zatcaCSIDIssuer.RenewCSIDAsync(new InputCSIDRenewingModel
                {
                    CSR = Convert.ToBase64String(Encoding.UTF8.GetBytes(csrFileContent)),
                    OTP = int.Parse(otptxtbox.Text)
                });

                if (result != null)
                {
                    //Save to Database  (Certificate & Secret & PrivateKey & CSR & StartedDate & ExpiredDate)
                    richTextBox1.Text = result.Certificate; //CSID (Certificate & UserName)
                    secretLbl.Text = result.Secret;
                    startedDateLbl.Text = result.StartedDate.ToString();
                    expiredDateLbl.Text = result.ExpiredDate.ToString();
                }
                else
                {
                    MessageBox.Show(ZatcaHttpClient.LastErrorMessage);
                }
            }
        }
    }
}
