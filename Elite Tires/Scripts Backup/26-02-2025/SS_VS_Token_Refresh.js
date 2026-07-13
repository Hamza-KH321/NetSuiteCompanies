/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */
define(["N/https", "N/record", "N/log", "N/encode"], function (https, record, log, encode) {

  function execute(context) {
    try {
      var ebayTokenRecord = record.load({ type: "customrecord_vs_ebay_token", id: 1, });
      var clientId = ebayTokenRecord.getValue({ fieldId: "custrecord_vs_client_id", });
      var clientSecret = ebayTokenRecord.getValue({ fieldId: "custrecord_vs_secret_id", });
      var refreshToken = ebayTokenRecord.getValue({ fieldId: "custrecord_vs_refresh_token", });
      var baseUrl = ebayTokenRecord.getValue({ fieldId: "custrecord_vs_base_url", });

      if (!clientId || !clientSecret || !refreshToken || !baseUrl) {
        log.error("Missing Credentials", "One or more required fields are empty.");
        return;
      }

      var authHeader = "Basic " + encodeBase64(clientId + ":" + clientSecret);
      var requestBody = {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        // scope: "https://api.ebay.com/oauth/api_scope",
      };

      var headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: authHeader,
        Accept: "*/*",
      };

      var response = https.post({
        url: baseUrl + "/identity/v1/oauth2/token",
        headers: headers,
        body: requestBody,
      });

      var responseBody = JSON.parse(response.body);

      if (response.code === 200 && responseBody.access_token) {
        log.debug("eBay OAuth Token Refresh Successful", responseBody);

        ebayTokenRecord.setValue({ fieldId: "custrecord_vs_token", value: responseBody.access_token, });
        ebayTokenRecord.save();

        log.debug("eBay Access Token Updated", "Record with ID: 1 updated successfully.");

      } else {
        log.error("eBay OAuth Token Refresh Failed", responseBody);
      }
    } catch (error) {
      log.error("Error in eBay OAuth Refresh", error);
    }
  }

  function encodeBase64(string) {
    return encode.convert({
      string: string,
      inputEncoding: encode.Encoding.UTF_8,
      outputEncoding: encode.Encoding.BASE_64,
    });
  }

  return {
    execute: execute,
  };
});
