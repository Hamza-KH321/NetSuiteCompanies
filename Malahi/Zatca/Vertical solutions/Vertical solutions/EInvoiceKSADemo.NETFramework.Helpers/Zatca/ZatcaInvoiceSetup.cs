///*
// * Author  : Ahmed Moosa
// * Email   : ahmed_moosa83@hotmail.com
// * LinkedIn: https://www.linkedin.com/in/ahmoosa/
// * Date    : 26/9/2022
// */
//using EInvoiceKSADemo.Helpers.Zatca.Helpers;
//using EInvoiceKSADemo.Helpers.Zatca.Models;
//using EInvoiceKSADemo.Helpers.Zatca.Services;
//using Microsoft.Extensions.Configuration;
//using Microsoft.Extensions.DependencyInjection;
//using System;
//using System.Collections.Generic;
//using System.Linq;
//using System.Text;
//using System.Threading.Tasks;

//namespace EInvoiceKSADemo.Helpers.Zatca
//{
//    public static class ZatcaInvoiceSetup
//    {
//        public static IServiceCollection AddZatcaServices(this IServiceCollection services, IConfiguration config)
//        {
//            services.AddTransient<IZatcaInvoiceSigner, ZatcaInvoiceSigner>();

//            services.AddTransient<IQrValidator, QRValidator>();
//            services.AddTransient<IEInvoiceSigner, EInvoiceSigner>();
//            services.AddTransient<IHashingValidator, HashingValidator>();

//            services.AddTransient<ICertificateConfiguration, CertificateConfiguration>();

//            services.AddTransient<IXmlInvoiceGenerator, XmlInvoiceGenerator>();
//            services.AddTransient<IZatcaAPICaller, ZatcaAPICaller>();
//            services.AddTransient<IZatcaReporter, ZatcaReporter>();


//            services.AddTransient<IZatcaCsrReader, ZatcaCsrReader>();
//            services.AddTransient<IZatcaCSIDIssuer, ZatcaCSIDIssuer>();

//            services.Configure<AppSettings>(config.GetSection("AppSettings"));

//            return services;
//        }
//    }
//}