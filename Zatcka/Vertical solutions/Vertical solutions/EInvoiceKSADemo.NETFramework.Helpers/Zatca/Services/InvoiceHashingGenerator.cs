using EInvoiceKSADemo.Helpers.Zatca.Models;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Xml;

namespace EInvoiceKSADemo.Helpers.Zatca.Services
{
    public class InvoiceHashingGenerator : IInvoiceHashingGenerator
    {
        public ZatcaResult Generate(string xmlFilePath)
        {
            try
            {
                XmlDocument xmlDoc = new XmlDocument();
                xmlDoc.PreserveWhitespace = true;
                try
                {
                    xmlDoc.LoadXml(xmlFilePath);
                }
                catch
                {
                    return ZatcaResult.Error("Error in loading XML file");
                }
                if (string.IsNullOrEmpty(xmlDoc.OuterXml))
                {
                    return ZatcaResult.Error("Empty or invalid invoice XML content");
                }
                string result = "";
                try
                {
                    result = ZatcaUtility.ApplyXSLT(xmlFilePath, XslSettings.Embeded_InvoiceXSLFileForHashing);
                }
                catch
                {
                    return ZatcaResult.Error("Can not apply XSL file");
                }
                if (string.IsNullOrEmpty(result))
                {
                    return ZatcaResult.Error("Error In applying XSL file");
                }
                using (MemoryStream msIn = new MemoryStream(Encoding.UTF8.GetBytes(result)))
                {
                    XmlDsigC14NTransform t = new XmlDsigC14NTransform(false);
                    t.LoadInput(msIn);
                    MemoryStream o = t.GetOutput() as MemoryStream;
                    string canonXml = Encoding.UTF8.GetString(o.ToArray());
                    byte[] data = ZatcaUtility.Sha256_hashAsBytes(canonXml);
                    var resultValue = ZatcaUtility.ToBase64Encode(data);
                    return ZatcaResult.Success(resultValue);
                }
            }
            catch (Exception ex)
            {
                return ZatcaResult.Error(ex.Message);
            }
        }
    }
}
