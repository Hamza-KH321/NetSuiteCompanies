using EInvoiceKSADemo.Helpers.Zatca.Models;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using System.Xml.Serialization;
using System.Xml.Xsl;

namespace EInvoiceKSADemo.Helpers.Zatca
{
    internal class ZatcaUtility
    {
        public static string GetNodeInnerText(XmlDocument doc, string xPath)
        {
            XmlNamespaceManager nsmgr = new XmlNamespaceManager(doc.NameTable);
            nsmgr.AddNamespace("cac", "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2");
            nsmgr.AddNamespace("cbc", "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2");
            nsmgr.AddNamespace("ext", "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2");
            XmlNode titleNode = doc.SelectSingleNode(xPath, nsmgr);
            if (titleNode != null)
            {
                return titleNode.InnerText;
            }
            return "";
        }

        public static string GetNodeInnerXML(XmlDocument doc, string xPath)
        {
            XmlNode titleNode = doc.SelectSingleNode(xPath);
            if (titleNode != null)
            {
                string canonXml = "";
                using (MemoryStream msIn = new MemoryStream(Encoding.UTF8.GetBytes(titleNode.OuterXml)))
                {
                    XmlDsigC14NTransform t = new XmlDsigC14NTransform(false);
                    t.LoadInput(msIn);
                    MemoryStream o = t.GetOutput() as MemoryStream;
                    canonXml = Encoding.UTF8.GetString(o.ToArray());
                }
                return canonXml.Replace("></ds:DigestMethod>", "/>");
            }
            return "";
        }

        public static void SetNodeValue(XmlDocument doc, string xPath, string value)
        {
            XmlNode titleNode = doc.SelectSingleNode(xPath);
            if (titleNode != null)
            {
                titleNode.InnerText = value;
            }
        }

        public static string GetNodeAttributeValue(XmlDocument doc, string xPath, string attributeName)
        {
            XmlNode titleNode = doc.SelectSingleNode(xPath);
            if (titleNode != null)
            {
                return titleNode.Attributes[attributeName].Value;
            }
            return "";
        }

        public static string ApplyXSLT(string xmlFilePath, string xsltFilePath)
        {
            StringBuilder output = new StringBuilder();
            XmlWriterSettings writerSettings = new XmlWriterSettings();
            writerSettings.OmitXmlDeclaration = true;
            writerSettings.Encoding = Encoding.UTF8;
            writerSettings.Indent = false;
            XmlWriter transformedData = XmlWriter.Create(output, writerSettings);
            try
            {
                XmlReader xmlReader = XmlReader.Create(ReadInternalEmbededResourceStream(xsltFilePath));
                XslCompiledTransform xsltTransform = new XslCompiledTransform();
                xsltTransform.Load(xmlReader);
                XmlReader input = XmlReader.Create(new StringReader(xmlFilePath));
                xsltTransform.Transform(input, transformedData);
            }
            finally
            {
                transformedData.Dispose();
            }
            return output.ToString();
        }

        public static string ApplyXSLTPassingXML(string xml, string xsltFilePath)
        {
            StringBuilder output = new StringBuilder();
            XmlWriterSettings writerSettings = new XmlWriterSettings();
            writerSettings.OmitXmlDeclaration = true;
            writerSettings.Encoding = Encoding.UTF8;
            writerSettings.Indent = true;
            writerSettings.ConformanceLevel = ConformanceLevel.Auto;
            XmlWriter transformedData = XmlWriter.Create(output, writerSettings);
            try
            {
                XmlReader xslReader = XmlReader.Create(ReadInternalEmbededResourceStream(xsltFilePath));
                XmlReader xmlReader = XmlReader.Create(new StringReader(xml));
                xmlReader.Read();
                XslCompiledTransform xsltTransform = new XslCompiledTransform();
                xsltTransform.Load(xslReader);
                xsltTransform.Transform(xmlReader, transformedData);
            }
            finally
            {
                transformedData.Dispose();
            }
            return output.ToString();
        }

        public static byte[] Sha256_hashAsBytes(string value)
        {
            SHA256 hash = SHA256.Create();
            return hash.ComputeHash(Encoding.UTF8.GetBytes(value));
        }

        public static string Sha256_hashAsString(string rawData)
        {
            StringBuilder Sb = new StringBuilder();
            using (SHA256 hash = SHA256.Create())
            {
                Encoding enc = Encoding.UTF8;
                byte[] result = hash.ComputeHash(Encoding.UTF8.GetBytes(rawData));
                byte[] array = result;
                foreach (byte b in array)
                {
                    Sb.Append(b.ToString("x2"));
                }
            }
            return Sb.ToString();
        }

        public static string ToBase64Encode(string toEncode)
        {
            byte[] toEncodeAsBytes = Encoding.ASCII.GetBytes(toEncode);
            return Convert.ToBase64String(toEncodeAsBytes);
        }

        public static string ToBase64Encode(byte[] value)
        {
            if (value == null)
            {
                return null;
            }
            return Convert.ToBase64String(value);
        }

        public static byte[] ToBase64DecodeAsBinary(string base64EncodedText)
        {
            if (string.IsNullOrEmpty(base64EncodedText))
            {
                return null;
            }
            return Convert.FromBase64String(base64EncodedText);
        }

        public static string GetInvoiceType(XmlDocument xmlDoc)
        {
            string typeCode = GetNodeAttributeValue(xmlDoc, XslSettings.Invoice_Type_XPATH, "name");
            if (typeCode.StartsWith("01"))
            {
                return "Standard";
            }
            return "Simplified";
        }

        public static Stream ReadInternalEmbededResourceStream(string resource)
        {
            var assemblyName = Assembly.GetExecutingAssembly().ManifestModule.Name;
            resource = assemblyName.Replace(Path.GetExtension(assemblyName), $".{resource}");
            return Assembly.GetExecutingAssembly().GetManifestResourceStream(resource);
        }

        public static void WriteTag(Stream stream, int tag)
        {
            bool firstByte = true;
            for (int i = 3; i >= 0; i--)
            {
                byte thisByte = (byte)(tag >> 8 * i);
                if (!(thisByte == 0 && firstByte) || i <= 0)
                {
                    if (firstByte)
                    {
                        if (i == 0)
                        {
                            if ((thisByte & 0x1F) == 31)
                            {
                                throw new Exception("Invalid tag value: first octet indicates subsequent octets, but no subsequent octets found");
                            }
                        }
                        else if ((thisByte & 0x1F) != 31)
                        {
                            throw new Exception("Invalid tag value: first octet indicates no subsequent octets, but subsequent octets found");
                        }
                    }
                    else if (i == 0)
                    {
                        if ((thisByte & 0x80) == 128)
                        {
                            throw new Exception("Invalid tag value: last octet indicates subsequent octets");
                        }
                    }
                    else if ((thisByte & 0x80) != 128)
                    {
                        throw new Exception("Invalid tag value: non-last octet indicates no subsequent octets");
                    }
                    stream.WriteByte(thisByte);
                    firstByte = false;
                }
            }
        }

        public static void WriteLength(Stream stream, int? length)
        {
            if (!length.HasValue)
            {
                stream.WriteByte(128);
                return;
            }
            if (length < 0 || length > uint.MaxValue)
            {
                throw new Exception($"Invalid length value: {length}");
            }
            if (length <= 127)
            {
                stream.WriteByte(checked((byte)length.Value));
                return;
            }
            byte lengthBytes;
            if (length <= 255)
            {
                lengthBytes = 1;
            }
            else if (length <= 65535)
            {
                lengthBytes = 2;
            }
            else if (length <= 16777215)
            {
                lengthBytes = 3;
            }
            else
            {
                if (!(length <= uint.MaxValue))
                {
                    throw new Exception($"Length value too big: {length}");
                }
                lengthBytes = 4;
            }
            stream.WriteByte((byte)(lengthBytes | 0x80u));
            for (int i = lengthBytes - 1; i >= 0; i--)
            {
                byte data = (byte)(length >> 8 * i).Value;
                stream.WriteByte(data);
            }
        }

        public static MemoryStream WriteTlv(int tag, byte[] value)
        {
            MemoryStream stream = new MemoryStream();
            WriteTag(stream, tag);
            int length = value != null ? value.Length : 0;
            WriteLength(stream, length);
            if (value == null)
            {
                throw new Exception("Please provide a value!");
            }
            stream.Write(value, 0, length);
            return stream;
        }
    }
}