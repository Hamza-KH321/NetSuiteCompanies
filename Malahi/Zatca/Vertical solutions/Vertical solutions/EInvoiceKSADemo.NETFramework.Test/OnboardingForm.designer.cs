using System.Drawing;
using System.Windows.Forms;

namespace EInvoiceKSADemo
{
    partial class OnboardingForm
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
            this.openFileDialog1 = new System.Windows.Forms.OpenFileDialog();
            this.uploadCsrBtn = new System.Windows.Forms.Button();
            this.label1 = new System.Windows.Forms.Label();
            this.label2 = new System.Windows.Forms.Label();
            this.otptxtbox = new System.Windows.Forms.TextBox();
            this.button2 = new System.Windows.Forms.Button();
            this.uploadedFileLbl = new System.Windows.Forms.Label();
            this.groupBox1 = new System.Windows.Forms.GroupBox();
            this.expiredDateLbl = new System.Windows.Forms.Label();
            this.startedDateLbl = new System.Windows.Forms.Label();
            this.label7 = new System.Windows.Forms.Label();
            this.label6 = new System.Windows.Forms.Label();
            this.secretLbl = new System.Windows.Forms.Label();
            this.label4 = new System.Windows.Forms.Label();
            this.richTextBox1 = new System.Windows.Forms.RichTextBox();
            this.label3 = new System.Windows.Forms.Label();
            this.renewBtn = new System.Windows.Forms.Button();
            this.secretTxt = new System.Windows.Forms.TextBox();
            this.groupBox1.SuspendLayout();
            this.SuspendLayout();
            // 
            // openFileDialog1
            // 
            this.openFileDialog1.FileName = "openFileDialog1";
            // 
            // uploadCsrBtn
            // 
            this.uploadCsrBtn.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.uploadCsrBtn.Location = new System.Drawing.Point(229, 27);
            this.uploadCsrBtn.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.uploadCsrBtn.Name = "uploadCsrBtn";
            this.uploadCsrBtn.Size = new System.Drawing.Size(258, 33);
            this.uploadCsrBtn.TabIndex = 0;
            this.uploadCsrBtn.Text = "Upload CSR File";
            this.uploadCsrBtn.UseVisualStyleBackColor = true;
            this.uploadCsrBtn.Click += new System.EventHandler(this.uploadCsrBtn_Click);
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.label1.Location = new System.Drawing.Point(158, 37);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(36, 20);
            this.label1.TabIndex = 1;
            this.label1.Text = "CSR";
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.label2.Location = new System.Drawing.Point(158, 106);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(37, 20);
            this.label2.TabIndex = 2;
            this.label2.Text = "OTP";
            // 
            // otptxtbox
            // 
            this.otptxtbox.Location = new System.Drawing.Point(229, 106);
            this.otptxtbox.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.otptxtbox.Name = "otptxtbox";
            this.otptxtbox.Size = new System.Drawing.Size(259, 24);
            this.otptxtbox.TabIndex = 3;
            // 
            // button2
            // 
            this.button2.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.button2.Location = new System.Drawing.Point(229, 147);
            this.button2.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.button2.Name = "button2";
            this.button2.Size = new System.Drawing.Size(130, 30);
            this.button2.TabIndex = 4;
            this.button2.Text = "Onboarding CSID";
            this.button2.UseVisualStyleBackColor = true;
            this.button2.Click += new System.EventHandler(this.button2_Click);
            // 
            // uploadedFileLbl
            // 
            this.uploadedFileLbl.AutoSize = true;
            this.uploadedFileLbl.Location = new System.Drawing.Point(229, 70);
            this.uploadedFileLbl.Name = "uploadedFileLbl";
            this.uploadedFileLbl.Size = new System.Drawing.Size(138, 17);
            this.uploadedFileLbl.TabIndex = 5;
            this.uploadedFileLbl.Text = "No CSR File Uploaded";
            // 
            // groupBox1
            // 
            this.groupBox1.Controls.Add(this.secretTxt);
            this.groupBox1.Controls.Add(this.expiredDateLbl);
            this.groupBox1.Controls.Add(this.startedDateLbl);
            this.groupBox1.Controls.Add(this.label7);
            this.groupBox1.Controls.Add(this.label6);
            this.groupBox1.Controls.Add(this.secretLbl);
            this.groupBox1.Controls.Add(this.label4);
            this.groupBox1.Controls.Add(this.richTextBox1);
            this.groupBox1.Controls.Add(this.label3);
            this.groupBox1.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.groupBox1.Location = new System.Drawing.Point(10, 212);
            this.groupBox1.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.groupBox1.Name = "groupBox1";
            this.groupBox1.Padding = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.groupBox1.Size = new System.Drawing.Size(710, 236);
            this.groupBox1.TabIndex = 6;
            this.groupBox1.TabStop = false;
            this.groupBox1.Text = "CSID Information";
            // 
            // expiredDateLbl
            // 
            this.expiredDateLbl.AutoSize = true;
            this.expiredDateLbl.Location = new System.Drawing.Point(115, 206);
            this.expiredDateLbl.Name = "expiredDateLbl";
            this.expiredDateLbl.Size = new System.Drawing.Size(0, 20);
            this.expiredDateLbl.TabIndex = 7;
            // 
            // startedDateLbl
            // 
            this.startedDateLbl.AutoSize = true;
            this.startedDateLbl.Location = new System.Drawing.Point(114, 169);
            this.startedDateLbl.Name = "startedDateLbl";
            this.startedDateLbl.Size = new System.Drawing.Size(0, 20);
            this.startedDateLbl.TabIndex = 6;
            // 
            // label7
            // 
            this.label7.AutoSize = true;
            this.label7.Location = new System.Drawing.Point(17, 206);
            this.label7.Name = "label7";
            this.label7.Size = new System.Drawing.Size(106, 20);
            this.label7.TabIndex = 5;
            this.label7.Text = "Expired Date :";
            // 
            // label6
            // 
            this.label6.AutoSize = true;
            this.label6.Location = new System.Drawing.Point(17, 169);
            this.label6.Name = "label6";
            this.label6.Size = new System.Drawing.Size(105, 20);
            this.label6.TabIndex = 4;
            this.label6.Text = "Started Date :";
            // 
            // secretLbl
            // 
            this.secretLbl.AutoSize = true;
            this.secretLbl.Location = new System.Drawing.Point(74, 128);
            this.secretLbl.Name = "secretLbl";
            this.secretLbl.Size = new System.Drawing.Size(0, 20);
            this.secretLbl.TabIndex = 3;
            // 
            // label4
            // 
            this.label4.AutoSize = true;
            this.label4.Location = new System.Drawing.Point(17, 128);
            this.label4.Name = "label4";
            this.label4.Size = new System.Drawing.Size(60, 20);
            this.label4.TabIndex = 2;
            this.label4.Text = "Secret :";
            // 
            // richTextBox1
            // 
            this.richTextBox1.Location = new System.Drawing.Point(74, 43);
            this.richTextBox1.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.richTextBox1.Name = "richTextBox1";
            this.richTextBox1.Size = new System.Drawing.Size(616, 66);
            this.richTextBox1.TabIndex = 1;
            this.richTextBox1.Text = "";
            // 
            // label3
            // 
            this.label3.AutoSize = true;
            this.label3.Location = new System.Drawing.Point(22, 43);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(54, 20);
            this.label3.TabIndex = 0;
            this.label3.Text = "CSID  :";
            // 
            // renewBtn
            // 
            this.renewBtn.Font = new System.Drawing.Font("Tahoma", 8F, System.Drawing.FontStyle.Bold);
            this.renewBtn.Location = new System.Drawing.Point(365, 147);
            this.renewBtn.Name = "renewBtn";
            this.renewBtn.Size = new System.Drawing.Size(123, 30);
            this.renewBtn.TabIndex = 7;
            this.renewBtn.Text = "Renew";
            this.renewBtn.UseVisualStyleBackColor = true;
            this.renewBtn.Click += new System.EventHandler(this.renewBtn_Click);
            // 
            // secretTxt
            // 
            this.secretTxt.Location = new System.Drawing.Point(78, 128);
            this.secretTxt.Name = "secretTxt";
            this.secretTxt.Size = new System.Drawing.Size(612, 27);
            this.secretTxt.TabIndex = 8;
            // 
            // OnboardingForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(7F, 16F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(731, 469);
            this.Controls.Add(this.renewBtn);
            this.Controls.Add(this.groupBox1);
            this.Controls.Add(this.uploadedFileLbl);
            this.Controls.Add(this.button2);
            this.Controls.Add(this.otptxtbox);
            this.Controls.Add(this.label2);
            this.Controls.Add(this.label1);
            this.Controls.Add(this.uploadCsrBtn);
            this.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.Name = "OnboardingForm";
            this.Text = "OnboardingForm";
            this.groupBox1.ResumeLayout(false);
            this.groupBox1.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private OpenFileDialog openFileDialog1;
        private Button uploadCsrBtn;
        private Label label1;
        private Label label2;
        private TextBox textBox1;
        private Button button2;
        private Label uploadedFileLbl;
        private TextBox otptxtbox;
        private GroupBox groupBox1;
        private Label label3;
        private Label secretLbl;
        private Label label4;
        private RichTextBox richTextBox1;
        private Label label7;
        private Label label6;
        private Label startedDateLbl;
        private Label expiredDateLbl;
        private Button renewBtn;
        private TextBox secretTxt;
    }
}