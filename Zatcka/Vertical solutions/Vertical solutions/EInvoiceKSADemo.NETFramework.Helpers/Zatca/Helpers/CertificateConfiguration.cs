/*
 * Author  : Ahmed Moosa
 * Email   : ahmed_moosa83@hotmail.com
 * LinkedIn: https://www.linkedin.com/in/ahmoosa/
 * Date    : 26/9/2022
 */
using EInvoiceKSADemo.Helpers.Zatca.Models;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EInvoiceKSADemo.Helpers.Zatca.Helpers
{
    public class CertificateConfiguration : ICertificateConfiguration
    {
        public CertificateDetails GetCertificateDetails()
        {
            // Select * from CretificateSettings
            // Test Data
            var certificateDetails = new CertificateDetails
            {
                Certificate = "TUlJRDFEQ0NBM21nQXdJQkFnSVRid0FBZTNVQVlWVTM0SS8rNVFBQkFBQjdkVEFLQmdncWhrak9QUVFEQWpCak1SVXdFd1lLQ1pJbWlaUHlMR1FCR1JZRmJHOWpZV3d4RXpBUkJnb0praWFKay9Jc1pBRVpGZ05uYjNZeEZ6QVZCZ29Ka2lhSmsvSXNaQUVaRmdkbGVIUm5ZWHAwTVJ3d0dnWURWUVFERXhOVVUxcEZTVTVXVDBsRFJTMVRkV0pEUVMweE1CNFhEVEl5TURZeE1qRTNOREExTWxvWERUSTBNRFl4TVRFM05EQTFNbG93U1RFTE1Ba0dBMVVFQmhNQ1UwRXhEakFNQmdOVkJBb1RCV0ZuYVd4bE1SWXdGQVlEVlFRTEV3MW9ZWGxoSUhsaFoyaHRiM1Z5TVJJd0VBWURWUVFERXdreE1qY3VNQzR3TGpFd1ZqQVFCZ2NxaGtqT1BRSUJCZ1VyZ1FRQUNnTkNBQVRUQUs5bHJUVmtvOXJrcTZaWWNjOUhEUlpQNGI5UzR6QTRLbTdZWEorc25UVmhMa3pVMEhzbVNYOVVuOGpEaFJUT0hES2FmdDhDL3V1VVk5MzR2dU1ObzRJQ0p6Q0NBaU13Z1lnR0ExVWRFUVNCZ0RCK3BId3dlakViTUJrR0ExVUVCQXdTTVMxb1lYbGhmREl0TWpNMGZETXRNVEV5TVI4d0hRWUtDWkltaVpQeUxHUUJBUXdQTXpBd01EYzFOVGc0TnpBd01EQXpNUTB3Q3dZRFZRUU1EQVF4TVRBd01SRXdEd1lEVlFRYURBaGFZWFJqWVNBeE1qRVlNQllHQTFVRUR3d1BSbTl2WkNCQ2RYTnphVzVsYzNNek1CMEdBMVVkRGdRV0JCU2dtSVdENmJQZmJiS2ttVHdPSlJYdkliSDlIakFmQmdOVkhTTUVHREFXZ0JSMllJejdCcUNzWjFjMW5jK2FyS2NybVRXMUx6Qk9CZ05WSFI4RVJ6QkZNRU9nUWFBL2hqMW9kSFJ3T2k4dmRITjBZM0pzTG5waGRHTmhMbWR2ZGk1ellTOURaWEowUlc1eWIyeHNMMVJUV2tWSlRsWlBTVU5GTFZOMVlrTkJMVEV1WTNKc01JR3RCZ2dyQmdFRkJRY0JBUVNCb0RDQm5UQnVCZ2dyQmdFRkJRY3dBWVppYUhSMGNEb3ZMM1J6ZEdOeWJDNTZZWFJqWVM1bmIzWXVjMkV2UTJWeWRFVnVjbTlzYkM5VVUxcEZhVzUyYjJsalpWTkRRVEV1WlhoMFoyRjZkQzVuYjNZdWJHOWpZV3hmVkZOYVJVbE9WazlKUTBVdFUzVmlRMEV0TVNneEtTNWpjblF3S3dZSUt3WUJCUVVITUFHR0gyaDBkSEE2THk5MGMzUmpjbXd1ZW1GMFkyRXVaMjkyTG5OaEwyOWpjM0F3RGdZRFZSMFBBUUgvQkFRREFnZUFNQjBHQTFVZEpRUVdNQlFHQ0NzR0FRVUZCd01DQmdnckJnRUZCUWNEQXpBbkJna3JCZ0VFQVlJM0ZRb0VHakFZTUFvR0NDc0dBUVVGQndNQ01Bb0dDQ3NHQVFVRkJ3TURNQW9HQ0NxR1NNNDlCQU1DQTBrQU1FWUNJUUNWd0RNY3E2UE8rTWNtc0JYVXovdjFHZGhHcDdycVNhMkF4VEtTdjgzOElBSWhBT0JOREJ0OSszRFNsaWpvVmZ4enJkRGg1MjhXQzM3c21FZG9HV1ZyU3BHMQ==",
                PrivateKey = "MHQCAQEEIDyLDaWIn/1/g3PGLrwupV4nTiiLKM59UEqUch1vDfhpoAcGBSuBBAAKoUQDQgAEYYMMoOaFYAhMO/steotfZyavr6p11SSlwsK9azmsLY7b1b+FLhqMArhB2dqHKboxqKNfvkKDePhpqjui5hcn0Q==",
                CSR = null,
                ExpiredDate = DateTime.Now.AddYears(5),
                StartedDate = DateTime.Now,
                Secret = "Xlj15LyMCgSC66ObnEO/qVPfhSbs3kDTjWnGheYhfSs=",
                UserName = "TUlJRDFEQ0NBM21nQXdJQkFnSVRid0FBZTNVQVlWVTM0SS8rNVFBQkFBQjdkVEFLQmdncWhrak9QUVFEQWpCak1SVXdFd1lLQ1pJbWlaUHlMR1FCR1JZRmJHOWpZV3d4RXpBUkJnb0praWFKay9Jc1pBRVpGZ05uYjNZeEZ6QVZCZ29Ka2lhSmsvSXNaQUVaRmdkbGVIUm5ZWHAwTVJ3d0dnWURWUVFERXhOVVUxcEZTVTVXVDBsRFJTMVRkV0pEUVMweE1CNFhEVEl5TURZeE1qRTNOREExTWxvWERUSTBNRFl4TVRFM05EQTFNbG93U1RFTE1Ba0dBMVVFQmhNQ1UwRXhEakFNQmdOVkJBb1RCV0ZuYVd4bE1SWXdGQVlEVlFRTEV3MW9ZWGxoSUhsaFoyaHRiM1Z5TVJJd0VBWURWUVFERXdreE1qY3VNQzR3TGpFd1ZqQVFCZ2NxaGtqT1BRSUJCZ1VyZ1FRQUNnTkNBQVRUQUs5bHJUVmtvOXJrcTZaWWNjOUhEUlpQNGI5UzR6QTRLbTdZWEorc25UVmhMa3pVMEhzbVNYOVVuOGpEaFJUT0hES2FmdDhDL3V1VVk5MzR2dU1ObzRJQ0p6Q0NBaU13Z1lnR0ExVWRFUVNCZ0RCK3BId3dlakViTUJrR0ExVUVCQXdTTVMxb1lYbGhmREl0TWpNMGZETXRNVEV5TVI4d0hRWUtDWkltaVpQeUxHUUJBUXdQTXpBd01EYzFOVGc0TnpBd01EQXpNUTB3Q3dZRFZRUU1EQVF4TVRBd01SRXdEd1lEVlFRYURBaGFZWFJqWVNBeE1qRVlNQllHQTFVRUR3d1BSbTl2WkNCQ2RYTnphVzVsYzNNek1CMEdBMVVkRGdRV0JCU2dtSVdENmJQZmJiS2ttVHdPSlJYdkliSDlIakFmQmdOVkhTTUVHREFXZ0JSMllJejdCcUNzWjFjMW5jK2FyS2NybVRXMUx6Qk9CZ05WSFI4RVJ6QkZNRU9nUWFBL2hqMW9kSFJ3T2k4dmRITjBZM0pzTG5waGRHTmhMbWR2ZGk1ellTOURaWEowUlc1eWIyeHNMMVJUV2tWSlRsWlBTVU5GTFZOMVlrTkJMVEV1WTNKc01JR3RCZ2dyQmdFRkJRY0JBUVNCb0RDQm5UQnVCZ2dyQmdFRkJRY3dBWVppYUhSMGNEb3ZMM1J6ZEdOeWJDNTZZWFJqWVM1bmIzWXVjMkV2UTJWeWRFVnVjbTlzYkM5VVUxcEZhVzUyYjJsalpWTkRRVEV1WlhoMFoyRjZkQzVuYjNZdWJHOWpZV3hmVkZOYVJVbE9WazlKUTBVdFUzVmlRMEV0TVNneEtTNWpjblF3S3dZSUt3WUJCUVVITUFHR0gyaDBkSEE2THk5MGMzUmpjbXd1ZW1GMFkyRXVaMjkyTG5OaEwyOWpjM0F3RGdZRFZSMFBBUUgvQkFRREFnZUFNQjBHQTFVZEpRUVdNQlFHQ0NzR0FRVUZCd01DQmdnckJnRUZCUWNEQXpBbkJna3JCZ0VFQVlJM0ZRb0VHakFZTUFvR0NDc0dBUVVGQndNQ01Bb0dDQ3NHQVFVRkJ3TURNQW9HQ0NxR1NNNDlCQU1DQTBrQU1FWUNJUUNWd0RNY3E2UE8rTWNtc0JYVXovdjFHZGhHcDdycVNhMkF4VEtTdjgzOElBSWhBT0JOREJ0OSszRFNsaWpvVmZ4enJkRGg1MjhXQzM3c21FZG9HV1ZyU3BHMQ=="
            };
            return certificateDetails;
        }

        public CertificateDetails GetCertificateDetails(string companyId)
        {
            // Select ......

            return new CertificateDetails
            {

            };
        }

        public async Task SaveCsrAndPK(InputCsrModel model)
        {
            var cert = new CertificateDetails
            {
                CSR = model.CSR,
                PrivateKey = model.PrivateKey,
            };

            //Save Cert to Database

        }

        public async Task UpdateCertificate(CSIDResultModel model)
        {
            var cert = GetCertificateDetails();
            if (cert != null)
            {
                cert.UserName = model.Certificate;
                cert.Certificate = model.Certificate;
                cert.Secret = model.Secret;
                cert.ExpiredDate = model.ExpiredDate;
                cert.StartedDate = model.StartedDate;
            }

            // Update Certificate Details in Database

        }
    }
}
