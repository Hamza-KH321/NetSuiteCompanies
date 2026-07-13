
using System.Drawing;
using System.Windows.Forms;
namespace EInvoiceKSADemo
{
    partial class CsrForm
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.label1 = new System.Windows.Forms.Label();
            this.VATtextBox = new System.Windows.Forms.TextBox();
            this.label2 = new System.Windows.Forms.Label();
            this.invoiceTypesComboBox = new System.Windows.Forms.ComboBox();
            this.TaxPayerNametextBox = new System.Windows.Forms.TextBox();
            this.label3 = new System.Windows.Forms.Label();
            this.addressTextBox = new System.Windows.Forms.TextBox();
            this.label4 = new System.Windows.Forms.Label();
            this.categoryTextBox = new System.Windows.Forms.TextBox();
            this.label5 = new System.Windows.Forms.Label();
            this.emailTextBox = new System.Windows.Forms.TextBox();
            this.label6 = new System.Windows.Forms.Label();
            this.generateButton = new System.Windows.Forms.Button();
            this.label7 = new System.Windows.Forms.Label();
            this.csrTypecomboBox = new System.Windows.Forms.ComboBox();
            this.SuspendLayout();
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Location = new System.Drawing.Point(24, 21);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(85, 17);
            this.label1.TabIndex = 0;
            this.label1.Text = "VAT Number";
            // 
            // VATtextBox
            // 
            this.VATtextBox.Location = new System.Drawing.Point(145, 21);
            this.VATtextBox.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.VATtextBox.Name = "VATtextBox";
            this.VATtextBox.Size = new System.Drawing.Size(258, 24);
            this.VATtextBox.TabIndex = 1;
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.Location = new System.Drawing.Point(21, 146);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(93, 17);
            this.label2.TabIndex = 2;
            this.label2.Text = "Invoice Types";
            // 
            // invoiceTypesComboBox
            // 
            this.invoiceTypesComboBox.FormattingEnabled = true;
            this.invoiceTypesComboBox.Location = new System.Drawing.Point(145, 146);
            this.invoiceTypesComboBox.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.invoiceTypesComboBox.Name = "invoiceTypesComboBox";
            this.invoiceTypesComboBox.Size = new System.Drawing.Size(258, 24);
            this.invoiceTypesComboBox.TabIndex = 4;
            // 
            // TaxPayerNametextBox
            // 
            this.TaxPayerNametextBox.Location = new System.Drawing.Point(145, 61);
            this.TaxPayerNametextBox.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.TaxPayerNametextBox.Name = "TaxPayerNametextBox";
            this.TaxPayerNametextBox.Size = new System.Drawing.Size(258, 24);
            this.TaxPayerNametextBox.TabIndex = 2;
            // 
            // label3
            // 
            this.label3.AutoSize = true;
            this.label3.Location = new System.Drawing.Point(24, 61);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(109, 17);
            this.label3.TabIndex = 4;
            this.label3.Text = "Tax Payer Name";
            // 
            // addressTextBox
            // 
            this.addressTextBox.Location = new System.Drawing.Point(145, 190);
            this.addressTextBox.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.addressTextBox.Name = "addressTextBox";
            this.addressTextBox.Size = new System.Drawing.Size(258, 24);
            this.addressTextBox.TabIndex = 5;
            // 
            // label4
            // 
            this.label4.AutoSize = true;
            this.label4.Location = new System.Drawing.Point(24, 190);
            this.label4.Name = "label4";
            this.label4.Size = new System.Drawing.Size(56, 17);
            this.label4.TabIndex = 6;
            this.label4.Text = "Address";
            // 
            // categoryTextBox
            // 
            this.categoryTextBox.Location = new System.Drawing.Point(145, 233);
            this.categoryTextBox.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.categoryTextBox.Name = "categoryTextBox";
            this.categoryTextBox.Size = new System.Drawing.Size(258, 24);
            this.categoryTextBox.TabIndex = 6;
            // 
            // label5
            // 
            this.label5.AutoSize = true;
            this.label5.Location = new System.Drawing.Point(21, 233);
            this.label5.Name = "label5";
            this.label5.Size = new System.Drawing.Size(120, 17);
            this.label5.TabIndex = 8;
            this.label5.Text = "Business Category";
            // 
            // emailTextBox
            // 
            this.emailTextBox.Location = new System.Drawing.Point(145, 103);
            this.emailTextBox.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.emailTextBox.Name = "emailTextBox";
            this.emailTextBox.Size = new System.Drawing.Size(258, 24);
            this.emailTextBox.TabIndex = 3;
            // 
            // label6
            // 
            this.label6.AutoSize = true;
            this.label6.Location = new System.Drawing.Point(24, 103);
            this.label6.Name = "label6";
            this.label6.Size = new System.Drawing.Size(105, 17);
            this.label6.TabIndex = 10;
            this.label6.Text = "Tax Payer Email";
            // 
            // generateButton
            // 
            this.generateButton.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.generateButton.Location = new System.Drawing.Point(144, 323);
            this.generateButton.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.generateButton.Name = "generateButton";
            this.generateButton.Size = new System.Drawing.Size(257, 39);
            this.generateButton.TabIndex = 8;
            this.generateButton.Text = "Generate Private Key and CSR";
            this.generateButton.UseVisualStyleBackColor = true;
            this.generateButton.Click += new System.EventHandler(this.generateButton_Click);
            // 
            // label7
            // 
            this.label7.AutoSize = true;
            this.label7.Location = new System.Drawing.Point(24, 275);
            this.label7.Name = "label7";
            this.label7.Size = new System.Drawing.Size(62, 17);
            this.label7.TabIndex = 13;
            this.label7.Text = "CSR For ";
            // 
            // csrTypecomboBox
            // 
            this.csrTypecomboBox.FormattingEnabled = true;
            this.csrTypecomboBox.Items.AddRange(new object[] {
            "Developer Or Simulation",
            "Production"});
            this.csrTypecomboBox.Location = new System.Drawing.Point(144, 274);
            this.csrTypecomboBox.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.csrTypecomboBox.Name = "csrTypecomboBox";
            this.csrTypecomboBox.Size = new System.Drawing.Size(259, 24);
            this.csrTypecomboBox.TabIndex = 7;
            // 
            // CsrForm
            // 
            this.AcceptButton = this.generateButton;
            this.AutoScaleDimensions = new System.Drawing.SizeF(7F, 16F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(648, 386);
            this.Controls.Add(this.csrTypecomboBox);
            this.Controls.Add(this.label7);
            this.Controls.Add(this.generateButton);
            this.Controls.Add(this.emailTextBox);
            this.Controls.Add(this.label6);
            this.Controls.Add(this.categoryTextBox);
            this.Controls.Add(this.label5);
            this.Controls.Add(this.addressTextBox);
            this.Controls.Add(this.label4);
            this.Controls.Add(this.TaxPayerNametextBox);
            this.Controls.Add(this.label3);
            this.Controls.Add(this.invoiceTypesComboBox);
            this.Controls.Add(this.label2);
            this.Controls.Add(this.VATtextBox);
            this.Controls.Add(this.label1);
            this.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.Name = "CsrForm";
            this.Text = "CsrForm";
            this.Load += new System.EventHandler(this.CsrForm_Load);
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private Label label1;
        private TextBox VATtextBox;
        private Label label2;
        private ComboBox invoiceTypesComboBox;
        private TextBox TaxPayerNametextBox;
        private Label label3;
        private TextBox addressTextBox;
        private Label label4;
        private TextBox categoryTextBox;
        private Label label5;
        private TextBox emailTextBox;
        private Label label6;
        private Button generateButton;
        private Label label7;
        private ComboBox csrTypecomboBox;
    }
}