/*
 * Author  : Ahmed Moosa
 * Email   : ahmed_moosa83@hotmail.com
 * LinkedIn: https://www.linkedin.com/in/ahmoosa/
 * Date    : 26/9/2022
 */
using EInvoiceKSADemo.Helpers.Zatca.Helpers;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EInvoiceKSADemo.Helpers.Zatca.Models
{
    public class InvoiceDataModel
    {
        //Inv/2023/2/131231
        public string InvoiceNumber { get; set; }
        /// <summary>
        /// GUID / UUID
        /// </summary>
        public string Id { get; set; }

        public int InvoiceType { get; set; }

        public int InvoiceTypeCode { get; set; }

        public string TransactionTypeCode { get; set; }

        public string Notes { get; set; }
        public int Order { get; set; }

        public string IssueDate { get; set; }

        public string IssueTime { get; set; }

        public string PreviousInvoiceHash { get; set; }

        public List<LineItem> Lines { get; set; }
        public Supplier Supplier { get; set; }

        public double Discount { get; set; }

        public string ReferenceId { get; set; }

        public int PaymentMeansCode { get; set; } = 10;


        /// <summary>
        /// VAT category taxable amount (BT-116) = ∑(Invoice line net amounts (BT-113)) − Document level allowance amount (BT-93)
        /// VAT category tax amount(BT-117) = VAT category taxable amount(BT-116) × (VAT rate (BT-119) ÷ 100)
        /// </summary>
        public double TaxAmount
        {
            get
            {
                var lineNetAmounts = double.Parse((this.Lines.Sum(l => l.TaxCategory == "S" ? l.TotalWithoutTax : 0)).ToString("0.00"));
                return double.Parse(((lineNetAmounts > 0 ? (lineNetAmounts - Discount) : 0) * Tax / 100).ToString("0.00"));
            }
        }

        public double TotalWithTax
        {
            get
            {

                return double.Parse((TaxAmount + TotalWithoutTax).ToString("0.00"));
            }
        }

        /// <summary>
        /// Invoice total amount without VAT (BT109) = Σ Invoice line net amount (BT-131) - Sum of allowances on document level (BT-107)
        /// Item line net amount (BT-131) = ((Item net price (BT-146) ÷ Item price base quantity(BT-149)) 
        ///     × (Invoiced Quantity (BT-129)) −Invoice line allowance amount(BT136)
        /// </summary>
        public double TotalWithoutTax
        {
            get
            {
                return double.Parse((this.Lines.Sum(l => l.TotalWithoutTax) - Discount).ToString("0.00"));
            }
        }

        public double TotalWithoutTaxAndDiscount
        {
            get
            {
                return double.Parse(this.Lines.Sum(l => l.TotalWithoutTax).ToString("0.00"));
            }
        }

        public int LinesCount
        {
            get { return this.Lines.Count; }
        }

        public Customer Customer { get; set; }

        public string DeliveryDate { get; set; }

        public double Tax { get; set; } = 15;

        public List<TaxSubtotal> SubTotals
        {
            get
            {
                var totals = this.Lines.GroupBy(l => l.TaxCategory, (c, r) => new TaxSubtotal
                {
                    TaxCategory = c,
                    Tax = r.FirstOrDefault().Tax,
                    TaxAmount = double.Parse((double.Parse((r.Sum(l => l.TotalWithoutTax) - double.Parse((c == DiscountTaxCategory ? Discount : 0).ToString("0.00"))).ToString("0.00")) * r.FirstOrDefault().Tax / 100).ToString("0.00")),
                    TotalWithoutTax = double.Parse(((r.Sum(l => l.TotalWithoutTax)) - double.Parse((c == DiscountTaxCategory ? Discount : 0).ToString("0.00"))).ToString("0.00")),
                    TaxCategoryReason = r.FirstOrDefault().TaxCategoryReason,
                    TaxCategoryReasonCode = r.FirstOrDefault().TaxCategoryReasonCode
                }).ToList();
                return totals;
            }
        }

        public string DiscountTaxCategory
        {
            get
            {
                var linesTaxCategories = this.Lines.Select(l => new { l.TaxCategory, l.Tax });
                var standard = linesTaxCategories.FirstOrDefault(c => c.TaxCategory == "S");
                Tax = standard != null ? standard.Tax : linesTaxCategories.FirstOrDefault().Tax;
                return standard != null ? "S" : linesTaxCategories.FirstOrDefault().TaxCategory;
            }
        }
    }

    public class TaxSubtotal
    {
        public double TotalWithoutTax { set; get; }
        public double TaxAmount { set; get; }

        public string TaxCategory { get; set; }
        public double Tax { get; set; }

     
        public string TaxCategoryReasonCode { set; get; }
        public string TaxCategoryReason { set; get; }
    }

    public class LineItem
    {
        public LineItem()
        {
            Id = Guid.NewGuid().ToString();
        }
        public string Id { get; set; }
        public int Index { get; set; }
        public string ProductName { get; set; }
        public double Quantity { get; set; }
        public double NetPrice { get; set; }
        public double LineDiscount { get; set; }
        public double PriceDiscount { get; set; }
        /// <summary>
        /// The line VAT amount (KSA-11) must be Invoice line net amount (BT-131) x(Line VAT rate (BT152)/100)
        /// </summary>
        public double TaxAmount
        {
            get
            {
                return double.Parse((TotalWithoutTax * Tax / 100).ToString("0.00"));
            }
        }
        public double TotalWithTax
        {
            get
            {
                return double.Parse((TaxAmount + TotalWithoutTax).ToString("0.00"));
            }
        }

        /// <summary>
        /// The invoice line net amount without VAT, and inclusive of line level allowance.
        /// Item line net amount (BT-131) = ((Item net price (BT-146) ÷ Item price base quantity(BT-149)) 
        ///     × (Invoiced Quantity (BT-129)) − Invoice line allowance amount(BT-136)
        /// </summary>
        public double TotalWithoutTax
        {
            get
            {
                //(float)
                return double.Parse(Math.Round((Quantity * NetPrice - LineDiscount), 3).ToString("0.00"));
            }
        }

        public double GrossPrice
        {
            get
            {
                return (NetPrice + PriceDiscount);
            }
        }

        public double Tax { get; set; }
        public string TaxCategory { get; set; } = "S";
        public string TaxCategoryReasonCode { set; get; }
        public string TaxCategoryReason { set; get; }
    }

    public class Supplier
    {
        public string SellerTRN { get; set; }
        public string SellerName { get; set; }

        public string StreetName { get; set; }
        public string CityName { get; set; }
        public string DistrictName { get; set; }

        public string BuildingNumber { get; set; }

        public string IdentityType { get; set; } = "CRN";

        public string IdentityNumber { get; set; }

        public string CountryCode { get; set; } = "SA";

        public string AdditionalStreetAddress { get; set; }

        public string PostalCode { get; set; }
    }

    public class Customer
    {
        public string IdentityType { get; set; }
        public string IdentityNumber { get; set; }

        public string StreetName { get; set; }
        public string BuildingNumber { get; set; }
        public string CityName { get; set; }
        public string RegionName { get; set; }
        public string DistrictName { get; set; }

        public string AdditionalStreetAddress { get; set; }
        public string VatRegNumber { get; set; }
        public string ZipCode { get; set; }

        public string CustomerName { get; set; }

        public string CountryCode { get; set; } = "SA";
    }
}