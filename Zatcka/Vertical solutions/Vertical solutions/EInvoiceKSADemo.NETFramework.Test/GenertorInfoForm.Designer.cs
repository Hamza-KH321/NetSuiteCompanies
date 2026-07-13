using System.Drawing;
using System.Windows.Forms;

namespace EInvoiceKSADemo
{
    partial class GenertorInfoForm
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
            this.generateXmlBtn = new System.Windows.Forms.Button();
            this.xmlRichTextBox = new System.Windows.Forms.RichTextBox();
            this.QrRichTextBox = new System.Windows.Forms.RichTextBox();
            this.generateQrCodeBtn = new System.Windows.Forms.Button();
            this.pictureBox1 = new System.Windows.Forms.PictureBox();
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).BeginInit();
            this.SuspendLayout();
            // 
            // generateXmlBtn
            // 
            this.generateXmlBtn.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.generateXmlBtn.Location = new System.Drawing.Point(210, 11);
            this.generateXmlBtn.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.generateXmlBtn.Name = "generateXmlBtn";
            this.generateXmlBtn.Size = new System.Drawing.Size(227, 38);
            this.generateXmlBtn.TabIndex = 0;
            this.generateXmlBtn.Text = "Generate Xml Before Signing";
            this.generateXmlBtn.UseVisualStyleBackColor = true;
            this.generateXmlBtn.Click += new System.EventHandler(this.generateXmlBtn_Click);
            // 
            // xmlRichTextBox
            // 
            this.xmlRichTextBox.Location = new System.Drawing.Point(10, 62);
            this.xmlRichTextBox.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.xmlRichTextBox.Name = "xmlRichTextBox";
            this.xmlRichTextBox.Size = new System.Drawing.Size(680, 97);
            this.xmlRichTextBox.TabIndex = 1;
            this.xmlRichTextBox.Text = "";
            // 
            // QrRichTextBox
            // 
            this.QrRichTextBox.Location = new System.Drawing.Point(10, 230);
            this.QrRichTextBox.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.QrRichTextBox.Name = "QrRichTextBox";
            this.QrRichTextBox.Size = new System.Drawing.Size(680, 97);
            this.QrRichTextBox.TabIndex = 3;
            this.QrRichTextBox.Text = "";
            // 
            // generateQrCodeBtn
            // 
            this.generateQrCodeBtn.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.generateQrCodeBtn.Location = new System.Drawing.Point(210, 176);
            this.generateQrCodeBtn.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.generateQrCodeBtn.Name = "generateQrCodeBtn";
            this.generateQrCodeBtn.Size = new System.Drawing.Size(227, 39);
            this.generateQrCodeBtn.TabIndex = 2;
            this.generateQrCodeBtn.Text = "Generate Qr Code";
            this.generateQrCodeBtn.UseVisualStyleBackColor = true;
            this.generateQrCodeBtn.Click += new System.EventHandler(this.generateQrCodeBtn_Click);
            // 
            // pictureBox1
            // 
            this.pictureBox1.Location = new System.Drawing.Point(247, 330);
            this.pictureBox1.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.pictureBox1.Name = "pictureBox1";
            this.pictureBox1.Size = new System.Drawing.Size(217, 197);
            this.pictureBox1.SizeMode = System.Windows.Forms.PictureBoxSizeMode.AutoSize;
            this.pictureBox1.TabIndex = 4;
            this.pictureBox1.TabStop = false;
            // 
            // GenertorInfoForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(7F, 16F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(701, 549);
            this.Controls.Add(this.pictureBox1);
            this.Controls.Add(this.QrRichTextBox);
            this.Controls.Add(this.generateQrCodeBtn);
            this.Controls.Add(this.xmlRichTextBox);
            this.Controls.Add(this.generateXmlBtn);
            this.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.Name = "GenertorInfoForm";
            this.Text = "Invoice Generator Info";
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).EndInit();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private Button generateXmlBtn;
        private RichTextBox xmlRichTextBox;
        private RichTextBox QrRichTextBox;
        private Button generateQrCodeBtn;
        private PictureBox pictureBox1;
    }
}