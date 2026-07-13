/*
 * Author  : Ahmed Moosa
 * Email   : ahmed_moosa83@hotmail.com
 * LinkedIn: https://www.linkedin.com/in/ahmoosa/
 * Date    : 26/9/2022
 */
using EInvoiceKSADemo.Helpers.Zatca.Models;
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml.Linq;

namespace EInvoiceKSADemo.Helpers.Zatca.Helpers
{
    public class XmlInvoiceGenerator : IXmlInvoiceGenerator
    {
        public string GenerateInvoiceAsXml<T>(string xmlFilePath, T model) where T : class
        {
            XDocument xDoc = XDocument.Load(xmlFilePath, LoadOptions.PreserveWhitespace);

            ReplaceContent(xDoc.Root, model);

            return XDocument.Parse(xDoc.ToString(), LoadOptions.PreserveWhitespace).ToString();
        }

        public string GenerateInvoiceAsXml<T>(Stream xmlFileStream, T model) where T : class
        {
            XDocument xDoc = XDocument.Load(xmlFileStream, LoadOptions.PreserveWhitespace);

            ReplaceContent(xDoc.Root, model);

            return XDocument.Parse(xDoc.ToString(), LoadOptions.PreserveWhitespace).ToString();
        }

        private void ReplaceContent(XElement xelement, object model)
        {
            if (xelement.HasElements)
            {
                foreach (var ele in xelement.Elements())
                {
                    if (ele.HasElements)
                    {
                        var ifAttribute = ele.Attribute("if");
                        if (ifAttribute != null)
                        {
                            if (model != null)
                            {
                                var ifValue = ifAttribute.Value.Replace("@", "");
                                var ifModel = GetValue(ifValue, model);
                                if (ifModel == null || ifModel == "0")
                                {
                                    var parent = ele.Parent;
                                    ele.Remove();
                                    ReplaceContent(parent, model);
                                }
                                ifAttribute.Remove();
                            }
                            else
                            {
                                var parent = ele.Parent;
                                ele.Remove();
                                ReplaceContent(parent, model);
                                continue;
                            }
                        }

                        var repeatAttribute = ele.Attribute("repeat");
                        if (repeatAttribute != null)
                        {
                            var list = GetValue<IList>(repeatAttribute.Value, model);
                            repeatAttribute.Remove();
                            for (int i = 0; i < list.Count; i++)
                            {
                                var copyOfEle = new XElement(ele);
                                ReplaceContent(copyOfEle, list[i]);
                                ele.AddBeforeSelf(copyOfEle);
                            }
                            ele.Remove();
                        }
                        else
                        {
                            var modelAttribute = ele.Attribute("model");
                            if (modelAttribute != null)
                            {
                                var obj = GetValue<object>(modelAttribute.Value, model);
                                modelAttribute.Remove();
                                ReplaceContent(ele, obj);
                            }
                            else
                            {
                                ReplaceContent(ele, model);
                            }
                        }
                    }
                    else
                    {
                        var ifAttribute = ele.Attribute("if");
                        if (ifAttribute != null)
                        {
                            if (model != null)
                            {
                                var ifValue = ifAttribute.Value.Replace("@", "");
                                var ifModel = GetValue(ifValue, model);
                                if (ifModel == null || ifModel == "0")
                                {
                                    var parent = ele.Parent;
                                    ele.Remove();
                                    ReplaceContent(parent, model);
                                }
                                else
                                {
                                    SetValue(ele, model);
                                }
                                ifAttribute.Remove();
                            }
                            else
                            {
                                var parent = ele.Parent;
                                ele.Remove();
                                ReplaceContent(parent, model);
                                continue;
                            }
                        }
                        else
                        {
                            SetValue(ele, model);
                        }
                    }
                }
            }
            else
            {
                SetValue(xelement, model);
            }
        }

        private void SetValue(XElement xelement, object model)
        {
            var prefix = "@";
            var attributeNames = xelement.Attributes().Where(att => att.Value.StartsWith(prefix));
            foreach (var att in attributeNames)
            {
                if (att != null)
                {
                    var attributeVariable = att.Value.Replace(prefix, "");
                    if (!string.IsNullOrEmpty(attributeVariable))
                    {
                        if (model != null)
                        {
                            var attributeValue = GetValue(attributeVariable, model);
                            if (!string.IsNullOrEmpty(attributeValue))
                            {
                                att.SetValue(attributeValue);
                            }
                            else
                            {
                                att.Remove();
                            }
                        }
                        else
                        {
                            att.Remove();
                        }
                    }
                }
            }

            var value = xelement.Value;
            if (!string.IsNullOrEmpty(value))
            {
                if (value.StartsWith(prefix))
                {
                    var variable = value.Replace(prefix, "");
                    if (!string.IsNullOrEmpty(variable))
                    {
                        if (model != null)
                        {
                            var modelValue = GetValue(variable, model);
                            if (!string.IsNullOrEmpty(modelValue))
                            {
                                xelement.SetValue(modelValue);
                            }
                            else
                            {
                                xelement.RemoveNodes();
                            }
                        }
                        else
                        {
                            xelement.RemoveNodes();
                        }
                    }
                }
            }
        }

        private string GetValue(string variable, object model)
        {
            // Get Value
            var propertyInfo = model.GetType().GetProperty(variable);
            if (propertyInfo != null)
            {
                if (propertyInfo.PropertyType == typeof(double))
                {
                    return Convert.ToString(propertyInfo.GetValue(model), new System.Globalization.CultureInfo("en"));
                }
                return propertyInfo.GetValue(model)?.ToString();
            }
            throw new Exception($"{variable} not Found in {model.GetType().ToString()} model!.");
        }

        private T GetValue<T>(string variable, object model)
        {
            // Get Value
            var propertyInfo = model.GetType().GetProperty(variable);
            if (propertyInfo != null)
            {
                T list = (T)propertyInfo.GetValue(model);
                return list;
            }
            throw new Exception($"{variable} not Found in {model.GetType().ToString()} model!.");
        }
    }
}
