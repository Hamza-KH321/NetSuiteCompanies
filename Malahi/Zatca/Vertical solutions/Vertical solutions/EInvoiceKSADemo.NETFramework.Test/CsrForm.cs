using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace EInvoiceKSADemo
{
    public partial class CsrForm : Form
    {
        public CsrForm()
        {
            InitializeComponent();
        }

        private void CsrForm_Load(object sender, EventArgs e)
        {
            invoiceTypesComboBox.DataSource = InvoiceTypes;
            invoiceTypesComboBox.DisplayMember = "Text";
            invoiceTypesComboBox.ValueMember = "Value";
        }

        private void generateButton_Click(object sender, EventArgs e)
        {
            var folderPath = Path.Combine(Directory.GetCurrentDirectory(), "Data");
            var templatePath = Path.Combine(folderPath, "CSRconfigTemplate.cnf");

            FolderBrowserDialog folderFileDialog = new FolderBrowserDialog();
            var result = folderFileDialog.ShowDialog();
            if (result == DialogResult.OK)
            {
                var csrFilePath = Path.Combine(folderFileDialog.SelectedPath, "CSRconfig.cnf");
                if (File.Exists(templatePath))
                {
                    ReplaceTemplateVariables(templatePath, csrFilePath);
                }
                if (File.Exists(csrFilePath))
                {
                    var folderToCreateFilesIn = folderFileDialog.SelectedPath;
                    var pkCmd = string.Format("openssl ecparam -name secp256k1 -genkey -noout -out PrivateKey.pem");
                    ExecuteGitCommand(folderToCreateFilesIn, pkCmd);
                    var csrCmd = string.Format("openssl req -new -sha256 -key PrivateKey.pem -extensions v3_req -config CSRconfig.cnf -out CSR.csr");
                    ExecuteGitCommand(folderToCreateFilesIn, csrCmd);

                    if (File.Exists(folderToCreateFilesIn + "/PrivateKey.pem") && File.Exists(folderToCreateFilesIn + "/CSR.csr"))
                    {
                        MessageBox.Show("Private Key and Csr File  Created Successfully!");
                        Process.Start("explorer.exe", folderToCreateFilesIn);
                    }
                }
            }
        }

        private void ReplaceTemplateVariables(string templatePath, string csrFilePath)
        {
            var templateContent = File.ReadAllText(templatePath);
            templateContent = templateContent.Replace("@Email", emailTextBox.Text);
            templateContent = templateContent.Replace("@Vat", VATtextBox.Text);
            templateContent = templateContent.Replace("@Branch", VATtextBox.Text.Substring(0, 10));
            templateContent = templateContent.Replace("@Name", TaxPayerNametextBox.Text);
            templateContent = templateContent.Replace("@Title", invoiceTypesComboBox.SelectedValue.ToString());
            templateContent = templateContent.Replace("@Address", addressTextBox.Text);
            templateContent = templateContent.Replace("@Category", categoryTextBox.Text);
            templateContent = templateContent.Replace("@Guid", Guid.NewGuid().ToString());
            templateContent = templateContent.Replace("@Pre", csrTypecomboBox.SelectedItem.ToString() == "Production" ? "" : "PRE");

            File.WriteAllText(csrFilePath, templateContent);
        }

        private static void ExecuteGitCommand(string folderPath, string cmd)
        {
            var programFilePath = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            var gitShellPath = Path.Combine(programFilePath, "Git\\bin\\sh.exe");
            ProcessStartInfo procStartInfo = new ProcessStartInfo(gitShellPath, "-c \" " + cmd);
            procStartInfo.CreateNoWindow = true;
            procStartInfo.WorkingDirectory = folderPath;
            Process proc = new Process();
            proc.StartInfo = procStartInfo;
            proc.Start();
            proc.WaitForExit();
            proc.Close();
        }

        private List<InvoiceTypeItem> InvoiceTypes
        {
            get
            {
                return new List<InvoiceTypeItem>()
                {
                    new InvoiceTypeItem{ Text = "Standard Only" , Value ="1000"},
                    new InvoiceTypeItem{ Text = "Simplified Only" , Value ="0100"},
                    new InvoiceTypeItem{ Text = "Standard and Simplified" , Value ="1100"}
                };
            }
        }
    }

    public class InvoiceTypeItem
    {
        public string Text { get; set; }
        public string Value { get; set; }
    }
}
