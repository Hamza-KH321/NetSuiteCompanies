using EInvoiceKSADemo.Helpers.Zatca.Interfaces;
using EInvoiceKSADemo.Helpers.Zatca.Models;
using EInvoiceKSADemo.Helpers.Zatca.Services;
using Org.BouncyCastle.Asn1.X509;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.Crypto.Digests;
using Org.BouncyCastle.Crypto.EC;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.Crypto.Signers;
using Org.BouncyCastle.OpenSsl;
using Org.BouncyCastle.Security;
using Org.BouncyCastle.X509;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;
using System.Xml;

namespace EInvoiceKSADemo.Helpers.Zatca.Helpers
{
    public class InvoiceInfoGenerator : IInvoiceInfoGenerator
    {
        private readonly ICertificateConfiguration _certificateSettings;
        private readonly IInvoiceHashingGenerator _hashingGenerator;
        private readonly IQrGenerator _qrGenerator;
        private readonly IXmlInvoiceGenerator _xmlGenerator;
        public InvoiceInfoGenerator(IXmlInvoiceGenerator xmlGenerator, ICertificateConfiguration certificateSettings, IInvoiceHashingGenerator hashingGenerator, IQrGenerator qrGenerator)
        {
            _xmlGenerator = xmlGenerator;
            _certificateSettings = certificateSettings;
            _hashingGenerator = hashingGenerator;
            _qrGenerator = qrGenerator;
        }
        public InvoiceInfoGenerator()
        {
            _xmlGenerator = new XmlInvoiceGenerator();
            _certificateSettings = new CertificateConfiguration();
            _hashingGenerator = new InvoiceHashingGenerator();
            _qrGenerator = new QrGenerator();
        }

        public GeneratorResult GenerateQrCode<T>(T model) where T : class
        {
            var certificateDetails = _certificateSettings.GetCertificateDetails();

            if (certificateDetails == null)
            {
                return GeneratorResult.Error("Certificate is Required");
            }
            if (certificateDetails.ExpiredDate < DateTime.Now || certificateDetails.StartedDate > DateTime.Now)
            {
                return GeneratorResult.Error("Certificate is Invalid");
            }
            if (string.IsNullOrEmpty(certificateDetails.Certificate))
            {
                return GeneratorResult.Error("Invalid certificate content.");
            }
            if (string.IsNullOrEmpty(certificateDetails.PrivateKey))
            {
                return GeneratorResult.Error("Invalid private key content.");
            }
            string certificateContent = Encoding.UTF8.GetString(Convert.FromBase64String(certificateDetails.Certificate));
            string privateKeyContent = certificateDetails.PrivateKey;


            //Generate XML 
            var xmlResult = GenerateXmlBeforeSigning(model);

            if (!xmlResult.Success)
            {
                return xmlResult;
            }

            XmlDocument xmlDoc = new XmlDocument();
            xmlDoc.PreserveWhitespace = true;
            try
            {
                xmlDoc.LoadXml(xmlResult.ResultValue);
            }
            catch
            {
                return GeneratorResult.Error("Can not load XML file.");
            }

            var hashingStepResult = _hashingGenerator.Generate(xmlResult.ResultValue);
            if (!hashingStepResult.IsValid)
            {
                return GeneratorResult.Error("Failed to hashing invoice");
            }

            var digitalSignatureResult = getDigitalSignature(hashingStepResult.ResultValue, privateKeyContent);

            if (!digitalSignatureResult.Success)
            {
                return digitalSignatureResult;
            }

            var newCertificate = getX509Certificate(certificateContent);
            if (newCertificate == null)
            {
                return GeneratorResult.Error("Failed to load certificate");
            }

            byte[] publicKeySByteArr = getPublicKey(newCertificate);

            var transformXmlResult = transformXML(xmlDoc.OuterXml);

            if (!transformXmlResult.Success)
            {
                return transformXmlResult;
            }

            XmlDocument transformedXmlDoc = new XmlDocument();
            transformedXmlDoc.PreserveWhitespace = true;
            transformedXmlDoc.LoadXml(transformXmlResult.ResultValue);

            var qrCodeResult = GenerateQRCode(transformedXmlDoc, publicKeySByteArr, digitalSignatureResult.ResultValue, hashingStepResult.ResultValue, newCertificate.GetSignature());

            return qrCodeResult;
        }

        private static byte[] getPublicKey(Org.BouncyCastle.X509.X509Certificate newCertificate)
        {
            SubjectPublicKeyInfo subjectPublicKeyInfo = SubjectPublicKeyInfoFactory.CreateSubjectPublicKeyInfo(newCertificate.GetPublicKey());
            byte[] publicKeySByteArr = subjectPublicKeyInfo.GetEncoded();
            return publicKeySByteArr;
        }

        private static Org.BouncyCastle.X509.X509Certificate getX509Certificate(string certificateContent)
        {
            byte[] certificateBytes = Convert.FromBase64String(certificateContent);
            X509Certificate2 x509Certificate = new X509Certificate2(certificateBytes);
            var newCertificate = DotNetUtilities.FromX509Certificate(x509Certificate);
            return newCertificate;
        }

        public GeneratorResult GenerateXmlBeforeSigning<T>(T model) where T : class
        {
            var xmlStream = ZatcaUtility.ReadInternalEmbededResourceStream(XslSettings.Embeded_InvoiceXmlFile);
            var invoiceXml = _xmlGenerator.GenerateInvoiceAsXml(xmlStream, model);
            if (!string.IsNullOrEmpty(invoiceXml))
            {
                return GeneratorResult.Succeeded(invoiceXml);
            }
            return GeneratorResult.Error("Xml cannot be generated");
        }

        private GeneratorResult getDigitalSignature(string xmlHashing, string privateKeyContent)
        {
            try
            {
                byte[] xmlHashingBytes = ZatcaUtility.ToBase64DecodeAsBinary(xmlHashing);
                if (!privateKeyContent.Contains("-----BEGIN EC PRIVATE KEY-----") && !privateKeyContent.Contains("-----END EC PRIVATE KEY-----"))
                {
                    privateKeyContent = "-----BEGIN EC PRIVATE KEY-----\n" + privateKeyContent + "\n-----END EC PRIVATE KEY-----";
                }
                using (TextReader text_reader = new StringReader(privateKeyContent))
                {
                    ECDsaSigner signer = new ECDsaSigner(new HMacDsaKCalculator(new Sha256Digest()));
                    ECDomainParameters domainParameters = new ECDomainParameters(CustomNamedCurves.GetByName("secp256k1"));

                    PemReader pemReader = new PemReader(text_reader);
                    AsymmetricCipherKeyPair keyPair = (AsymmetricCipherKeyPair)pemReader.ReadObject();
                    ECPrivateKeyParameters privateKeyParams = (ECPrivateKeyParameters)keyPair.Private;
                    var pk = privateKeyParams.D;
                    ECPrivateKeyParameters privateKeyParameters = new ECPrivateKeyParameters(pk, domainParameters);

                    signer.Init(true, privateKeyParameters);

                    var digitalSignatureBytes = signer.GenerateSignature(xmlHashingBytes);

                    var resultValue = Convert.ToBase64String(BigIntegerArrayToByteArray(digitalSignatureBytes));

                    return GeneratorResult.Succeeded(resultValue);
                }
            }
            catch (Exception ex)
            {
                return GeneratorResult.Error(ex.Message);
            }
        }
        private byte[] BigIntegerArrayToByteArray(Org.BouncyCastle.Math.BigInteger[] bigIntegerArray)
        {
            // Calculate the total number of bytes needed
            int byteCount = bigIntegerArray.Sum(bi => bi.ToByteArray().Length);

            byte[] byteArray = new byte[byteCount];
            int currentIndex = 0;

            // Convert each BigInteger to a byte array and copy to the result array
            foreach (Org.BouncyCastle.Math.BigInteger bigInteger in bigIntegerArray)
            {
                byte[] currentBytes = bigInteger.ToByteArray();
                Array.Reverse(currentBytes); // Reverse the byte order if necessary

                Array.Copy(currentBytes, 0, byteArray, currentIndex, currentBytes.Length);
                currentIndex += currentBytes.Length;
            }

            return byteArray;
        }

      
        private GeneratorResult GenerateQRCode(XmlDocument xmlDoc, byte[] publicKeyArr, string signature, string hashedXml, byte[] certificateSignatureBytes)
        {
            string SELLER_NAME = ZatcaUtility.GetNodeInnerText(xmlDoc, XslSettings.SELLER_NAME_XPATH);
            if (string.IsNullOrEmpty(SELLER_NAME))
            {
                return GeneratorResult.Error("Unable to get SELLER_NAME value");
            }
            string VAT_REGISTERATION = ZatcaUtility.GetNodeInnerText(xmlDoc, XslSettings.VAT_REGISTERATION_XPATH);
            if (string.IsNullOrEmpty(VAT_REGISTERATION))
            {
                return GeneratorResult.Error("Unable to get VAT_REGISTERATION value");
            }
            string ISSUE_DATE = ZatcaUtility.GetNodeInnerText(xmlDoc, XslSettings.ISSUE_DATE_XPATH);
            if (string.IsNullOrEmpty(ISSUE_DATE))
            {
                return GeneratorResult.Error("Unable to get ISSUE_DATE value");
            }
            string ISSUE_TIME = ZatcaUtility.GetNodeInnerText(xmlDoc, XslSettings.ISSUE_TIME_XPATH);
            if (string.IsNullOrEmpty(ISSUE_TIME))
            {
                return GeneratorResult.Error("Unable to get ISSUE_TIME value");
            }
            string INVOICE_TOTAL = ZatcaUtility.GetNodeInnerText(xmlDoc, XslSettings.INVOICE_TOTAL_XPATH);
            if (string.IsNullOrEmpty(INVOICE_TOTAL))
            {
                return GeneratorResult.Error("Unable to get INVOICE_TOTAL value");
            }
            string VAT_TOTAL = ZatcaUtility.GetNodeInnerText(xmlDoc, XslSettings.VAT_TOTAL_XPATH);
            if (string.IsNullOrEmpty(VAT_TOTAL))
            {
                return GeneratorResult.Error("Unable to get VAT_TOTAL value");
            }
            string QR_CODE = ZatcaUtility.GetNodeInnerText(xmlDoc, XslSettings.QR_CODE_XPATH);
            DateTime issueDateTime = default;
            string issueFullTimeSpan = ISSUE_DATE + " " + ISSUE_TIME;
            DateTime.TryParseExact(ISSUE_DATE, XslSettings.allDatesFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out issueDateTime);
            string[] arrTimeParts = ISSUE_TIME.Split(':');
            int hours = 0;
            int minutes = 0;
            int seconds = 0;
            if (!string.IsNullOrEmpty(arrTimeParts[0]) && int.TryParse(arrTimeParts[0], out hours))
            {
                issueDateTime = issueDateTime.AddHours(hours);
            }
            if (arrTimeParts.Length > 1 && !string.IsNullOrEmpty(arrTimeParts[1]) && int.TryParse(arrTimeParts[1], out minutes))
            {
                issueDateTime = issueDateTime.AddMinutes(minutes);
            }
            if (arrTimeParts.Length > 2 && !string.IsNullOrEmpty(arrTimeParts[2]) && int.TryParse(arrTimeParts[2], out seconds))
            {
                issueDateTime = issueDateTime.AddSeconds(seconds);
            }
            string issueDateTimeStr = issueDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'");
            bool isSimplified = false;
            string invoiceType = ZatcaUtility.GetInvoiceType(xmlDoc);
            if (invoiceType == "Simplified")
            {
                isSimplified = true;
            }
            string qrCodeValue = _qrGenerator.Generate(SELLER_NAME, VAT_REGISTERATION, issueDateTimeStr, INVOICE_TOTAL, VAT_TOTAL, hashedXml, publicKeyArr, signature, isSimplified, certificateSignatureBytes);
            try
            {
                return GeneratorResult.Succeeded(qrCodeValue);
            }
            catch
            {
                return GeneratorResult.Error("Qr Element not found in XML file.");
            }
        }

        private GeneratorResult transformXML(string xmlContent)
        {
            string resultXML = "";
            try
            {
                resultXML = ZatcaUtility.ApplyXSLTPassingXML(xmlContent, XslSettings.Embeded_Remove_Elements_PATH);
            }
            catch (Exception)
            {
                return GeneratorResult.Error("Error in removing elements.");
            }
            try
            {
                resultXML = ZatcaUtility.ApplyXSLTPassingXML(resultXML, XslSettings.Embeded_Add_UBL_Element_PATH);
            }
            catch (Exception)
            {
                return GeneratorResult.Error("Error in adding UBL elements.");
            }
            try
            {
                resultXML = resultXML.Replace("UBL-TO-BE-REPLACED", new StreamReader(ZatcaUtility.ReadInternalEmbededResourceStream(XslSettings.Embeded_UBL_File_PATH)).ReadToEnd());
            }
            catch (Exception)
            {
                return GeneratorResult.Error("Error in replacing UBL elements.");
            }
            try
            {
                resultXML = ZatcaUtility.ApplyXSLTPassingXML(resultXML, XslSettings.Embeded_Add_QR_Element_PATH);
            }
            catch (Exception)
            {
                return GeneratorResult.Error("Error in adding QR elements.");
            }
            try
            {
                resultXML = resultXML.Replace("QR-TO-BE-REPLACED", new StreamReader(ZatcaUtility.ReadInternalEmbededResourceStream(XslSettings.Embeded_QR_XML_File_PATH)).ReadToEnd());
            }
            catch (Exception)
            {
                return GeneratorResult.Error("Error in replacing QR elements.");
            }
            try
            {
                resultXML = ZatcaUtility.ApplyXSLTPassingXML(resultXML, XslSettings.Embeded_Add_Signature_Element_PATH);
            }
            catch (Exception)
            {
                return GeneratorResult.Error("Error in adding signature elements.");
            }
            try
            {
                resultXML = resultXML.Replace("SIGN-TO-BE-REPLACED", new StreamReader(ZatcaUtility.ReadInternalEmbededResourceStream(XslSettings.Embeded_Signature_File_PATH)).ReadToEnd());
            }
            catch (Exception)
            {
                return GeneratorResult.Error("Error in replacing signature elements.");
            }
            if (resultXML != null)
            {
                return GeneratorResult.Succeeded(resultXML);
            }
            return GeneratorResult.Error("Cannot transform invoice xml file.");
        }
    }
}
