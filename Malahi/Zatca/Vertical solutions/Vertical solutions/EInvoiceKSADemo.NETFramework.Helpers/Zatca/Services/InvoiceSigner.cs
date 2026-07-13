using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Numerics;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Xml;
using EInvoiceKSADemo.Helpers.Zatca.Helpers;
using EInvoiceKSADemo.Helpers.Zatca.Models;
using Org.BouncyCastle.Asn1;
using Org.BouncyCastle.Asn1.X509;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.Crypto.Digests;
using Org.BouncyCastle.Crypto.EC;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.Crypto.Signers;
using Org.BouncyCastle.OpenSsl;
using Org.BouncyCastle.Security;
using Org.BouncyCastle.X509;

namespace EInvoiceKSADemo.Helpers.Zatca.Services
{
    public class InvoiceSigner : IInvoiceSigner
    {
        private readonly ICertificateConfiguration _certificateSettings;

        public InvoiceSigner()
        {
            _certificateSettings = new CertificateConfiguration();
        }
        public InvoiceSigner(ICertificateConfiguration certificateSettings)
        {
            this._certificateSettings = certificateSettings;
        }
        public ZatcaResult Sign(string xmlFilePath)
        {
            var certificateDetails = _certificateSettings.GetCertificateDetails();

            if (certificateDetails == null)
            {
                return ZatcaResult.Error("Certificate is Required");
            }

            if (certificateDetails.ExpiredDate < DateTime.Now || certificateDetails.StartedDate > DateTime.Now)
            {
                return ZatcaResult.Error("Certificate is Invalid");
            }

            string certificateContent = Encoding.UTF8.GetString(Convert.FromBase64String(certificateDetails.Certificate));
            string privateKeyContent = certificateDetails.PrivateKey;

            ZatcaResult result = new ZatcaResult();
            try
            {
                if (string.IsNullOrEmpty(certificateContent))
                {
                    return ZatcaResult.Error("Invalid certificate content.");
                }
                if (string.IsNullOrEmpty(privateKeyContent))
                {
                    return ZatcaResult.Error("Invalid private key content.");
                }
                XmlDocument xmlDoc = new XmlDocument();
                xmlDoc.PreserveWhitespace = true;
                try
                {
                    xmlDoc.LoadXml(xmlFilePath);
                }
                catch
                {
                    return ZatcaResult.Error("Can not load XML file.");
                }
                if (string.IsNullOrEmpty(xmlDoc.InnerText))
                {
                    return ZatcaResult.Error("Empty or invalid invoice XML content");
                }
                result.Steps = new List<ZatcaResult>();
                ZatcaResult hashingStepResult = new ZatcaResult();
                InvoiceHashingGenerator hashingGenerator = new InvoiceHashingGenerator();
                hashingStepResult = hashingGenerator.Generate(xmlFilePath);
                hashingStepResult.StepType = StepType.InvoiceHash;
                if (!hashingStepResult.IsValid)
                {
                    result.Steps.Add(hashingStepResult);
                    return result;
                }
                result.Steps.Add(hashingStepResult);
                ZatcaResult digitalSignatureStepResult = new ZatcaResult();
                digitalSignatureStepResult = getDigitalSignature(hashingStepResult.ResultValue, privateKeyContent);
                if (!digitalSignatureStepResult.IsValid)
                {
                    result.Steps.Add(digitalSignatureStepResult);
                    return result;
                }
                result.Steps.Add(digitalSignatureStepResult);
                ZatcaResult certificateStepResult = new ZatcaResult();

                byte[] certificateBytes = Convert.FromBase64String(certificateContent);
                X509Certificate2 x509Certificate = new X509Certificate2(certificateBytes);
                var newCertificate = DotNetUtilities.FromX509Certificate(x509Certificate);
                SubjectPublicKeyInfo subjectPublicKeyInfo = SubjectPublicKeyInfoFactory.CreateSubjectPublicKeyInfo(newCertificate.GetPublicKey());
                byte[] publicKeySByteArr = subjectPublicKeyInfo.GetEncoded();
                var serialNumber = new BigInteger(x509Certificate.GetSerialNumber());
                if (x509Certificate != null)
                {
                    certificateStepResult.IsValid = true;
                    result.Steps.Add(certificateStepResult);
                    ZatcaResult certfHashingStepResult = new ZatcaResult();
                    try
                    {
                        certfHashingStepResult.IsValid = true;
                        certfHashingStepResult.ResultValue = ZatcaUtility.ToBase64Encode(ZatcaUtility.Sha256_hashAsString(certificateContent));
                        result.Steps.Add(certfHashingStepResult);
                    }
                    catch (Exception ex2)
                    {
                        certfHashingStepResult.ErrorMessage = ex2.Message;
                        result.Steps.Add(certfHashingStepResult);
                        return result;
                    }
                    ZatcaResult transformXMLResult = new ZatcaResult();
                    transformXMLResult = transformXML(xmlDoc.OuterXml);

                    if (!transformXMLResult.IsValid)
                    {
                        result.Steps.Add(transformXMLResult);
                        return result;
                    }
                    result.Steps.Add(transformXMLResult);
                    XmlDocument newXmlDoc = new XmlDocument();
                    newXmlDoc.PreserveWhitespace = true;
                    newXmlDoc.LoadXml(transformXMLResult.ResultValue);
                    Dictionary<string, string> nameSpacesMap = getNameSpacesMap();
                    ZatcaResult signedPropertiesHashing = new ZatcaResult();
                    signedPropertiesHashing = populateSignedSignatureProperties(newXmlDoc, nameSpacesMap, certfHashingStepResult.ResultValue, getCurrentTimestamp(), x509Certificate.IssuerName.Name, serialNumber.ToString());

                    if (!signedPropertiesHashing.IsValid)
                    {
                        result.Steps.Add(signedPropertiesHashing);
                        return result;
                    }
                    result.Steps.Add(signedPropertiesHashing);
                    ZatcaResult populateUBLExtensionsResult = new ZatcaResult();
                    populateUBLExtensionsResult = populateUBLExtensions(newXmlDoc, digitalSignatureStepResult.ResultValue, signedPropertiesHashing.ResultValue, hashingStepResult.ResultValue, certificateContent);

                    if (!populateUBLExtensionsResult.IsValid)
                    {
                        result.Steps.Add(populateUBLExtensionsResult);
                        return result;
                    }
                    result.Steps.Add(populateUBLExtensionsResult);
                    ZatcaResult populateQRResult = new ZatcaResult();
                    populateQRResult = populateQRCode(newXmlDoc, publicKeySByteArr, digitalSignatureStepResult.ResultValue, hashingStepResult.ResultValue, newCertificate.GetSignature());
                    populateQRResult.StepType = StepType.QrCode;

                    if (!populateQRResult.IsValid)
                    {
                        result.Steps.Add(populateQRResult);
                        return result;
                    }
                    result.Steps.Add(populateQRResult);
                    result.IsValid = true;
                    result.SingedXML = newXmlDoc.OuterXml;
                    ZatcaResult signedInvoiceBase64 = new ZatcaResult();
                    try
                    {
                        signedInvoiceBase64.IsValid = true;
                        signedInvoiceBase64.StepType = StepType.InvoiceBase64;
                        signedInvoiceBase64.ResultValue = Convert.ToBase64String(Encoding.UTF8.GetBytes(newXmlDoc.OuterXml));

                    }
                    catch (Exception ex3)
                    {
                        result.IsValid = false;
                        signedInvoiceBase64.ErrorMessage = ex3.Message;
                    }
                    result.Steps.Add(signedInvoiceBase64);
                    result.UUID = ZatcaUtility.GetNodeInnerText(xmlDoc, XslSettings.UUID_XPATH);
                    result.PreviousInvoiceHash = ZatcaUtility.GetNodeInnerText(xmlDoc, XslSettings.PIH_XPATH);
                    result.IsSimplified = ZatcaUtility.GetInvoiceType(xmlDoc) == "Simplified";

                    return result;
                }
                certificateStepResult.ErrorMessage = "Invalid Certificate";
                result.Steps.Add(certificateStepResult);
                return result;
            }
            catch (Exception ex)
            {
                result.ErrorMessage = ex.Message;
                return result;
            }
        }

        private ZatcaResult populateUBLExtensions(XmlDocument xmlDoc, string digitalSignature, string signedPropertiesHashing, string xmlHashing, string certificate)
        {
            try
            {
                ZatcaUtility.SetNodeValue(xmlDoc, XslSettings.SIGNATURE_XPATH, digitalSignature);
                ZatcaUtility.SetNodeValue(xmlDoc, XslSettings.CERTIFICATE_XPATH, certificate);
                ZatcaUtility.SetNodeValue(xmlDoc, XslSettings.SIGNED_Properities_DIGEST_VALUE_XPATH, signedPropertiesHashing);
                ZatcaUtility.SetNodeValue(xmlDoc, XslSettings.Hash_XPATH, xmlHashing);
            }
            catch (Exception ex)
            {
                return ZatcaResult.Error(ex.Message);
            }
            return ZatcaResult.Success();
        }

        private ZatcaResult populateSignedSignatureProperties(XmlDocument document, Dictionary<string, string> nameSpacesMap, string publicKeyHashing, string signatureTimestamp, string x509IssuerName, string serialNumber)
        {
            try
            {
                ZatcaUtility.SetNodeValue(document, XslSettings.PUBLIC_KEY_HASHING_XPATH, publicKeyHashing);
                ZatcaUtility.SetNodeValue(document, XslSettings.SIGNING_TIME_XPATH, signatureTimestamp);
                ZatcaUtility.SetNodeValue(document, XslSettings.ISSUER_NAME_XPATH, x509IssuerName);
                ZatcaUtility.SetNodeValue(document, XslSettings.X509_SERIAL_NUMBER_XPATH, serialNumber);
                string signedSignatureElement = ZatcaUtility.GetNodeInnerXML(document, XslSettings.SIGNED_PROPERTIES_XPATH);
                signedSignatureElement = signedSignatureElement.Replace(" />", "/>");
                signedSignatureElement = signedSignatureElement.Replace("></ds:DigestMethod>", "/>");
                string dd = ZatcaUtility.Sha256_hashAsString(signedSignatureElement.Replace("\r", ""));
                var result = ZatcaUtility.ToBase64Encode(ZatcaUtility.Sha256_hashAsString(signedSignatureElement.Replace("\r", "")));
                return ZatcaResult.Success(result);
            }
            catch (Exception ex)
            {
                return ZatcaResult.Error(ex.Message);
            }
        }

        private string getCurrentTimestamp()
        {
            return DateTime.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'");
        }

        private Dictionary<string, string> getNameSpacesMap()
        {
            Dictionary<string, string> nameSpaces = new Dictionary<string, string>();
            nameSpaces.Add("cac", "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2");
            nameSpaces.Add("cbc", "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2");
            nameSpaces.Add("ext", "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2");
            nameSpaces.Add("sig", "urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2");
            nameSpaces.Add("sac", "urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2");
            nameSpaces.Add("sbc", "urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2");
            nameSpaces.Add("ds", "http://www.w3.org/2000/09/xmldsig#");
            nameSpaces.Add("xades", "http://uri.etsi.org/01903/v1.3.2#");
            return nameSpaces;
        }
        private ZatcaResult getDigitalSignature(string xmlHashing, string privateKeyContent)
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

                    return ZatcaResult.Success(resultValue);
                }
            }
            catch (Exception ex)
            {
                return ZatcaResult.Error(ex.Message);
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
        
        //private ZatcaResult getDigitalSignature2(string xmlHashing, string privateKeyContent)
        //{
        //    try
        //    {
        //        byte[] xmlHashingBytes = ZatcaUtility.ToBase64DecodeAsBinary(xmlHashing);
        //        if (!privateKeyContent.Contains("-----BEGIN EC PRIVATE KEY-----") && !privateKeyContent.Contains("-----END EC PRIVATE KEY-----"))
        //        {
        //            privateKeyContent = "-----BEGIN EC PRIVATE KEY-----\n" + privateKeyContent + "\n-----END EC PRIVATE KEY-----";
        //        }
        //        byte[] digitalSignatureBytes;
        //        using (TextReader text_reader = new StringReader(privateKeyContent))
        //        {
        //            PemReader pemReader = new PemReader(text_reader);
        //            object pemObject = pemReader.ReadObject();
        //            AsymmetricKeyParameter result = ((AsymmetricCipherKeyPair)pemObject).Private;
        //            ISigner signer = SignerUtilities.GetSigner("SHA-256withECDSA");
        //            signer.Init(true, result);
        //            signer.BlockUpdate(xmlHashingBytes, 0, xmlHashingBytes.Length);
        //            digitalSignatureBytes = signer.GenerateSignature();
        //        }
        //        var resultValue = Convert.ToBase64String(digitalSignatureBytes);
        //        return ZatcaResult.Success(resultValue);
        //    }
        //    catch (Exception ex)
        //    {
        //        return ZatcaResult.Error(ex.Message);
        //    }
        //}

        private ZatcaResult transformXML(string xmlContent)
        {
            string resultXML = "";
            try
            {
                resultXML = ZatcaUtility.ApplyXSLTPassingXML(xmlContent, XslSettings.Embeded_Remove_Elements_PATH);
            }
            catch (Exception)
            {
                return ZatcaResult.Error("Error in removing elements.");
            }
            try
            {
                resultXML = ZatcaUtility.ApplyXSLTPassingXML(resultXML, XslSettings.Embeded_Add_UBL_Element_PATH);
            }
            catch (Exception)
            {
                return ZatcaResult.Error("Error in adding UBL elements.");
            }
            try
            {
                resultXML = resultXML.Replace("UBL-TO-BE-REPLACED", new StreamReader(ZatcaUtility.ReadInternalEmbededResourceStream(XslSettings.Embeded_UBL_File_PATH)).ReadToEnd());
            }
            catch (Exception)
            {
                return ZatcaResult.Error("Error in replacing UBL elements.");
            }
            try
            {
                resultXML = ZatcaUtility.ApplyXSLTPassingXML(resultXML, XslSettings.Embeded_Add_QR_Element_PATH);
            }
            catch (Exception)
            {
                return ZatcaResult.Error("Error in adding QR elements.");
            }
            try
            {
                resultXML = resultXML.Replace("QR-TO-BE-REPLACED", new StreamReader(ZatcaUtility.ReadInternalEmbededResourceStream(XslSettings.Embeded_QR_XML_File_PATH)).ReadToEnd());
            }
            catch (Exception)
            {
                return ZatcaResult.Error("Error in replacing QR elements.");
            }
            try
            {
                resultXML = ZatcaUtility.ApplyXSLTPassingXML(resultXML, XslSettings.Embeded_Add_Signature_Element_PATH);
            }
            catch (Exception)
            {
                return ZatcaResult.Error("Error in adding signature elements.");
            }
            try
            {
                resultXML = resultXML.Replace("SIGN-TO-BE-REPLACED", new StreamReader(ZatcaUtility.ReadInternalEmbededResourceStream(XslSettings.Embeded_Signature_File_PATH)).ReadToEnd());
            }
            catch (Exception)
            {
                return ZatcaResult.Error("Error in replacing signature elements.");
            }
            if (resultXML != null)
            {
                return ZatcaResult.Success(resultXML);
            }
            return ZatcaResult.Error("Cannot transform invoice xml file.");
        }

        private ZatcaResult populateQRCode(XmlDocument xmlDoc, byte[] publicKeyArr, string signature, string hashedXml, byte[] certificateSignatureBytes)
        {
            string SELLER_NAME = ZatcaUtility.GetNodeInnerText(xmlDoc, XslSettings.SELLER_NAME_XPATH);
            if (string.IsNullOrEmpty(SELLER_NAME))
            {
                return ZatcaResult.Error("Unable to get SELLER_NAME value");
            }
            string VAT_REGISTERATION = ZatcaUtility.GetNodeInnerText(xmlDoc, XslSettings.VAT_REGISTERATION_XPATH);
            if (string.IsNullOrEmpty(VAT_REGISTERATION))
            {
                return ZatcaResult.Error("Unable to get VAT_REGISTERATION value");
            }
            string ISSUE_DATE = ZatcaUtility.GetNodeInnerText(xmlDoc, XslSettings.ISSUE_DATE_XPATH);
            if (string.IsNullOrEmpty(ISSUE_DATE))
            {
                return ZatcaResult.Error("Unable to get ISSUE_DATE value");
            }
            string ISSUE_TIME = ZatcaUtility.GetNodeInnerText(xmlDoc, XslSettings.ISSUE_TIME_XPATH);
            if (string.IsNullOrEmpty(ISSUE_TIME))
            {
                return ZatcaResult.Error("Unable to get ISSUE_TIME value");
            }
            string INVOICE_TOTAL = ZatcaUtility.GetNodeInnerText(xmlDoc, XslSettings.INVOICE_TOTAL_XPATH);
            if (string.IsNullOrEmpty(INVOICE_TOTAL))
            {
                return ZatcaResult.Error("Unable to get INVOICE_TOTAL value");
            }
            string VAT_TOTAL = ZatcaUtility.GetNodeInnerText(xmlDoc, XslSettings.VAT_TOTAL_XPATH);
            if (string.IsNullOrEmpty(VAT_TOTAL))
            {
                return ZatcaResult.Error("Unable to get VAT_TOTAL value");
            }

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
            if (arrTimeParts.Length > 2 && !string.IsNullOrEmpty(arrTimeParts[2]) && int.TryParse(arrTimeParts[2].Substring(0, 2), out seconds))
            {
                issueDateTime = issueDateTime.AddSeconds(seconds);
            }
            string issueDateTimeStr = issueDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'",new CultureInfo("en"));
            bool isSimplified = false;
            string invoiceType = ZatcaUtility.GetInvoiceType(xmlDoc);
            if (invoiceType == "Simplified")
            {
                isSimplified = true;
            }
            QrGenerator qrGenerator = new QrGenerator();
            string qrCodeValue = qrGenerator.Generate(SELLER_NAME, VAT_REGISTERATION, issueDateTimeStr, INVOICE_TOTAL, VAT_TOTAL, hashedXml, publicKeyArr, signature, isSimplified, certificateSignatureBytes);
            try
            {
                ZatcaUtility.SetNodeValue(xmlDoc, XslSettings.QR_CODE_XPATH, qrCodeValue);
                return ZatcaResult.Success(qrCodeValue);
            }
            catch
            {
                return ZatcaResult.Error("There is no node for QR in XML file.");
            }
        }


        //public Result CreateCSR(string privateKeyContent)
        //{
        //    //CertificateRequest certificateRequest = new CertificateRequest()
        //    var subjectName = "CN=www.copanyName.com,O=Company Name,OU=Department,T=Area,ST=State,C=Country";

        //    // Create new Object for Issuer and Subject
        //    var issuer = new X509Name(subjectName);
        //    var subject = new X509Name(subjectName);

        //    // Generate the key Value Pair, which in our case is a public Key
        //    var randomGenerator = new Org.BouncyCastle.Crypto.Prng.VmpcRandomGenerator();// //.CryptoApiRandomGenerator();
        //    var random = new SecureRandom(randomGenerator);
        //    AsymmetricCipherKeyPair subjectKeyPair = default(AsymmetricCipherKeyPair);
        //    const int strength = 2048;
        //    var keyGenerationParameters = new KeyGenerationParameters(random, strength);

        //    var keyPairGenerator = new RsaKeyPairGenerator();
        //    keyPairGenerator.Init(keyGenerationParameters);
        //    subjectKeyPair = keyPairGenerator.GenerateKeyPair();
        //    AsymmetricCipherKeyPair issuerKeyPair = subjectKeyPair;

        //    //PKCS #10 Certificate Signing Request
        //    Pkcs10CertificationRequest csr = new Pkcs10CertificationRequest("SHA1WITHRSA", subject, issuerKeyPair.Public, null, issuerKeyPair.Private);

        //    //Convert BouncyCastle CSR to .PEM file.
        //    StringBuilder CSRPem = new StringBuilder();
        //    PemWriter CSRPemWriter = new PemWriter(new StringWriter(CSRPem));
        //    CSRPemWriter.WriteObject(csr);
        //    CSRPemWriter.Writer.Flush();

        //    //get CSR text
        //    var CSRtext = CSRPem.ToString();

        //    // Write content into a Txt file
        //    //using (StreamWriter f = new StreamWriter(@"C:\Cert_TEST\DemoCSR.txt"))
        //    //{
        //    //    f.Write(CSRtext);
        //    //}
        //    return new Result
        //    {
        //        IsValid = true,
        //        ResultedValue = CSRtext,
        //    };
        //}
    }
}
