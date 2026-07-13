/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */

define(["N/https", "N/record", "N/log", "N/encode", "N/search"], function (https, record, log, encode, search) {
  
  function execute(context) {
    try {
      // Perform a search to retrieve all eBay token records dynamically
      var customrecord_vs_ebay_tokenSearchObj = search.create({
        type: "customrecord_vs_ebay_token",
        filters: [],
        columns: [
          search.createColumn({ name: "internalid" }),
          search.createColumn({ name: "custrecord_vs_client_id" }),
          search.createColumn({ name: "custrecord_vs_secret_id" }),
          search.createColumn({ name: "custrecord_vs_refresh_token" }),
          search.createColumn({ name: "custrecord_vs_base_url" })
        ]
      });

      var searchResults = customrecord_vs_ebay_tokenSearchObj.run().getRange({ start: 0, end: 1000 });

      // Ensure records exist before proceeding
      if (!searchResults || searchResults.length === 0) {
        log.error("No eBay Token Records Found", "No matching records were found.");
        return;
      }

      log.audit("Total Records Found", searchResults.length);

      // Iterate over each record found in the search
      for (var i = 0; i < searchResults.length; i++) {
        var ebayTokenRecordId = searchResults[i].getValue({ name: "internalid" });

        log.audit("Processing eBay Token Record", "Record ID: " + ebayTokenRecordId);

        // Load the eBay token record dynamically
        var ebayTokenRecord = record.load({
          type: "customrecord_vs_ebay_token",
          id: ebayTokenRecordId
        });

        // Retrieve stored credentials dynamically from the custom record
        var clientId = ebayTokenRecord.getValue({ fieldId: "custrecord_vs_client_id" });
        var clientSecret = ebayTokenRecord.getValue({ fieldId: "custrecord_vs_secret_id" });
        var refreshToken = ebayTokenRecord.getValue({ fieldId: "custrecord_vs_refresh_token" });
        var baseUrl = ebayTokenRecord.getValue({ fieldId: "custrecord_vs_base_url" });

        // Validate that all required credentials are present before proceeding
        if (!clientId || !clientSecret || !refreshToken || !baseUrl) {
          log.error("Missing Credentials", "One or more required fields are empty for record ID: " + ebayTokenRecordId);
          continue; // Skip this record and move to the next
        }

        // Construct the authorization header using Base64 encoding
        var authHeader = "Basic " + encodeBase64(clientId + ":" + clientSecret);

        // Prepare the request body for OAuth token refresh
        var requestBody = {
          grant_type: "refresh_token",
          refresh_token: refreshToken
        };

        // Define request headers for the API call
        var headers = {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: authHeader,
          Accept: "*/*"
        };

        // Make the HTTP POST request to refresh the token
        var response = https.post({
          url: baseUrl + "/identity/v1/oauth2/token",
          headers: headers,
          body: requestBody
        });

        // Parse the response body into a JSON object
        var responseBody = JSON.parse(response.body);

        // If the request is successful (HTTP 200) and an access token is received
        if (response.code === 200 && responseBody.access_token) {
          log.audit("eBay OAuth Token Refresh Successful", {
            recordId: ebayTokenRecordId,
            newAccessToken: responseBody.access_token
          });

          // Update the custom record with the new access token
          ebayTokenRecord.setValue({ fieldId: "custrecord_vs_token", value: responseBody.access_token });
          ebayTokenRecord.save();

          log.audit("eBay Access Token Updated", "Record ID: " + ebayTokenRecordId + " updated successfully.");
        } else {
          // Log error if the response is not successful
          log.error("eBay OAuth Token Refresh Failed", {
            recordId: ebayTokenRecordId,
            response: responseBody
          });
        }
      }
    } catch (error) {
      // Catch and log any errors that occur during execution
      log.error("Error in eBay OAuth Refresh", error);
    }
  }

  function encodeBase64(string) {
    return encode.convert({
      string: string,
      inputEncoding: encode.Encoding.UTF_8,
      outputEncoding: encode.Encoding.BASE_64
    });
  }

  return {
    execute: execute
  };
});
