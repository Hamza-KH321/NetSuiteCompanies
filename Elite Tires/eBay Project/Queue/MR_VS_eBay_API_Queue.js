/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(["N/search", "N/record", "N/https", "N/log", "N/file", "N/runtime"], function (search, record, https, log, file, runtime) {

    function getInputData() {
      return search.create({
        type: "customrecord_vs_ebay_queue",
        filters: [["custrecord_vs_ebay_configuration_rec", "noneof", "@NONE@"],
                  "AND", 
                  ["custrecord_vs_processed","is","Processing"]
                 ],
        columns: [
          search.createColumn({ name: "id", label: "ID" }),
          search.createColumn({ name: "custrecord_vs_item_to_update", label: "Item to Update", }),
          search.createColumn({ name: "custrecord_vs_update_type", label: "Update Type", }),
          search.createColumn({ name: "custrecord_vs_record_id", label: "Record ID", }),
          search.createColumn({ name: "custrecord_vs_processed", label: "Processed", }),
          search.createColumn({ name: "custrecord_vs_errors", label: "Errors" }),
          search.createColumn({ name: "custrecord_vs_ebay_configuration_rec", label: "eBay Configuration", }),
          search.createColumn({ name: "custrecord_vs_quantity", label: "Quantity", }),
          search.createColumn({ name: "purchasedescription", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Purchase Description", }),
          search.createColumn({ name: "salesdescription", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Description", }),
          search.createColumn({ name: "displayname", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Display Name", }),
          search.createColumn({ name: "custitem_atlas_item_image", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Item Image", }),
          search.createColumn({ name: "custrecord_vs_token", join: "CUSTRECORD_VS_EBAY_CONFIGURATION_REC", label: "Token", }),
          search.createColumn({ name: "custrecord_vs_base_url", join: "CUSTRECORD_VS_EBAY_CONFIGURATION_REC", label: "Base URL", }),
          search.createColumn({ name: "itemid", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Part No", }),
          search.createColumn({ name: "custitem_bold_pattern", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Bolt Pattern", }),
          search.createColumn({ name: "custitem_vs_bore_diameter", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Bore Diameter", }),
          search.createColumn({ name: "custitem_thick", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Thickness", }),
          search.createColumn({ name: "custitem_vs_material", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Material", }),
          search.createColumn({ name: "custitem_finish", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Finish", }),
          search.createColumn({ name: "custitem_vs_compatibility", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Compatibility", }),
          search.createColumn({ name: "custitem_wheel_color", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Color", }),
          search.createColumn({ name: "custitem_vs_packing_way", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Packing Way", }),
          search.createColumn({ name: "custitem_group", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Group", }),
          search.createColumn({ name: "custitem_vs_recap", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Recap", }),
          search.createColumn({ name: "custitem_vs_key_features", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Key Features", }),
          search.createColumn({ name: "custitem_vs_dimensions", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Dimensions", }),
          search.createColumn({ name: "custitemwheel_weight_lbs", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Weight", }),
          search.createColumn({ name: "custitem_vs_whats_included", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Whats Included", }),
          search.createColumn({ name: "custitem_vs_recap", join: "CUSTRECORD_VS_ITEM_TO_UPDATE", label: "Recap", }),
  
        ],
      });
    }
  
    function map(context) {
      try {
          var result = JSON.parse(context.value);
  
          var queueRecordId = result.id;
          var itemToUpdate = result.values["custrecord_vs_item_to_update"].value;
          var updateType = result.values["custrecord_vs_update_type"];
          var quantity = parseInt(result.values["custrecord_vs_quantity"] || 0, 10);
          var itemName = result.values["custrecord_vs_item_to_update"].text;
          var purchaseDescription = result.values["purchasedescription.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var displayName = result.values["displayname.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var partNumber = result.values["itemid.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var boltPattern = result.values["custitem_bold_pattern.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var boreDiameter = result.values["custitem_vs_bore_diameter.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var thickness = result.values["custitem_thick.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var material = result.values["custitem_vs_material.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var finish = result.values["custitem_finish.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var compatibility = result.values["custitem_vs_compatibility.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var color = result.values["custitem_wheel_color.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var packingWay = result.values["custitem_vs_packing_way.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var group = result.values["custitem_group.CUSTRECORD_VS_ITEM_TO_UPDATE"].text;
          var recap = result.values["custitem_vs_recap.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var keyFeatures = result.values["custitem_vs_key_features.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var dimensions = result.values["custitem_vs_dimensions.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var weight = result.values["custitemwheel_weight_lbs.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var whatsIncluded = result.values["custitem_vs_whats_included.CUSTRECORD_VS_ITEM_TO_UPDATE"];
          var accessToken = result.values["custrecord_vs_token.CUSTRECORD_VS_EBAY_CONFIGURATION_REC"];
          var baseUrl = result.values["custrecord_vs_base_url.CUSTRECORD_VS_EBAY_CONFIGURATION_REC"];
          var imageUrl = result.values["custitem_atlas_item_image.CUSTRECORD_VS_ITEM_TO_UPDATE"].text;
  
          var encodedItemName = encodeURIComponent(itemName);
          var accountId = runtime.accountId.replace("_", "-").toLowerCase();
          var imageBaseUrl = "https://" + accountId + ".app.netsuite.com";
          var fullImageUrl = imageBaseUrl + imageUrl;
  
          log.debug('mapdata', {
              queueRecordId: queueRecordId,
              itemToUpdate: itemToUpdate,
              updateType: updateType,   
              quantity: quantity,
              itemName: itemName,
              encodedItemName: encodedItemName,
              purchaseDescription: purchaseDescription,
              displayName: displayName,
              partNumber: partNumber,
              boltPattern: boltPattern,
              boreDiameter: boreDiameter,
              thickness: thickness,
              material: material,
              finish: finish,
              compatibility: compatibility,
              color: color,
              packingWay: packingWay,
              group: group,
              recap: recap,
              keyFeatures: keyFeatures,
              dimensions: dimensions,
              weight: weight,
              whatsIncluded: whatsIncluded,
              accessToken: accessToken,
              baseUrl: baseUrl,
              imageUrl: imageUrl,
              fullImageUrl: fullImageUrl
          });
  
          var endpoint = baseUrl + "/sell/inventory/v1/inventory_item/" + encodedItemName;
          var requestBody = {};
  
          var htmlDescription = 
          '<div rwr="1" size="4" style="font-family:Arial; line-height:1.6;">' +
              '<table width="1000" border="1" cellpadding="5" style="border-collapse:collapse; width:100%; border:1px solid #ccc;">' +
                  '<tbody>' +
                      '<tr>' +
                          '<th width="300" rowspan="7" style="text-align:center; vertical-align:top; padding:10px;">' +
                              '<img src="' + fullImageUrl + '" width="280" height="280" alt="' + (itemName || "NA") + '" style="border:1px solid #ddd; border-radius:4px;">' +
                          '</th>' +
                          '<th width="700" height="32" style="font-size: 24px; text-align:left; padding:10px; background-color:#f8f8f8; border-bottom:1px solid #ccc;">' +
                              'PART NO: ' + (partNumber || "NA") +
                          '</th>' +
                      '</tr>' +
                      '<tr><td style="font-size: 20px; padding:10px;"><strong>Bolt Pattern:</strong> ' + (boltPattern || "NA") + '</td></tr>' +
                      '<tr><td style="font-size: 20px; padding:10px;"><strong>Bore Diameter:</strong> ' + (boreDiameter || "NA") + '</td></tr>' +
                      '<tr><td style="font-size: 20px; padding:10px;"><strong>Thickness:</strong> ' + (thickness || "NA") + '</td></tr>' +
                      '<tr><td style="font-size: 20px; padding:10px;"><strong>Material:</strong> ' + (material || "NA") + '</td></tr>' +
                      '<tr><td style="font-size: 20px; padding:10px;"><strong>Finish:</strong> ' + (finish || "NA") + '</td></tr>' +
                      '<tr><td style="font-size: 20px; padding:10px;"><strong>Included:</strong> ' + (whatsIncluded || "NA") + '</td></tr>' +
                      '<tr>' +
                          '<th colspan="2" style="text-align:center; padding:20px; background-color:#eaf8ea; border-top:2px solid #28a745;">' +
                              '<table width="800" border="0" cellpadding="5" style="margin:auto;">' +
                                  '<tbody>' +
                                      '<tr>' +
                                          '<th width="514" style="font-size: 36px; text-align:center; color:#28a745; font-weight:bold;">' +
                                              'SAME DAY PROCESSING' +
                                          '</th>' +
                                          '<th width="260" style="text-align:center;">' +
                                              '<img src="https://i.ebayimg.com/00/s/MzQwWDM0MA==/z/YIMAAOSw2BdjK3nB/$_27.PNG?set_id=8800005007" width="249" height="249" alt="Same Day Processing Icon" style="border:1px solid #ddd; border-radius:4px;">' +
                                          '</th>' +
                                      '</tr>' +
                                  '</tbody>' +
                              '</table>' +
                          '</th>' +
                      '</tr>' +
                  '</tbody>' +
              '</table>' +
              '<div style="margin-top:20px; font-size:18px; padding:15px; border:1px solid #ccc; border-radius:4px; background-color:#f9f9f9;">' +
                  '<h2 style="color:#333; text-align:left; font-size:24px;">' + (displayName || "NA") + '</h2>' +
                  '<p style="margin-top:10px; color:#555; text-align:left;">' + (purchaseDescription || "NA") + '</p>' +
                  '<h3 style="color:#333; font-size:20px; margin-top:15px;">Key Features:</h3>' +
                  '<ul style="color:#555; padding-left:20px; line-height:1.8;">' + (keyFeatures || "NA") + '</ul>' +
                  '<h3 style="color:#333; font-size:20px; margin-top:15px;">Specifications:</h3>' +
                  '<ul style="color:#555; padding-left:20px; line-height:1.8;">' +
                      '<li><strong>Color:</strong> ' + (color || "NA") + '</li>' +
                      '<li><strong>Weight:</strong> ' + (weight || "NA") + ' lbs</li>' +
                      '<li><strong>Dimensions:</strong> ' + (dimensions || "NA") + '</li>' +
                  '</ul>' +
                  '<h3 style="color:#333; font-size:20px; margin-top:15px;">What’s Included:</h3>' +
                  '<ul style="color:#555; padding-left:20px; line-height:1.8;">' + (whatsIncluded || "NA") + '</ul>' +
              '</div>' +
              '<div style="margin-top:30px; padding:15px; border:1px solid #ccc; border-radius:4px; background-color:#f4f4f4;">' +
                  '<h3 style="color:#333; font-size:20px;">Policies</h3>' +
                  '<ul style="color:#555; line-height:1.8; padding-left:20px;">' +
                      '<li><strong>Returns:</strong> Not accepted for this product.</li>' +
                      '<li><strong>Warranty:</strong> Sold as-is with no warranty.</li>' +
                      '<li><strong>Shipping Guarantee:</strong> Ships within 2 business days.</li>' +
                  '</ul>' +
              '</div>' +
          '</div>';
  
          if (updateType === "Item Creation/Update") {
              requestBody = {
                  product: {
                      title: purchaseDescription,
                      description: htmlDescription,
                      upc: ['Test UPC'],
                      imageUrls: [fullImageUrl],
                  },
              };
          } else if (updateType === "Item Availability") {
              requestBody = {
                  availability: {
                      shipToLocationAvailability: {
                          quantity: quantity,
                      },
                  },
              };
          }
  
          log.debug("Sending API Request", {endpoint: endpoint, requestBody: requestBody});
  
          var response = https.put({
              url: endpoint,
              headers: {
                  Authorization: "Bearer " + accessToken,
                  "Content-Type": "application/json",
                  "content-Language": "en-US",
                  "Accept": "*/*",
              },
              body: JSON.stringify(requestBody),
          });
  
          log.debug("API Response", response);
          log.debug("API Response", {statusCode: response.code, responseBody: response.body});
  
          if (response.code === 200 || response.code === 204) {
              record.submitFields({
                  type: "customrecord_vs_ebay_queue",
                  id: queueRecordId,
                  values: { custrecord_vs_processed: "Completed", custrecord_vs_errors: " " },
              });
          } else {
              record.submitFields({
                  type: "customrecord_vs_ebay_queue",
                  id: queueRecordId,
                  values: {
                      custrecord_vs_processed: "Error",
                      custrecord_vs_errors: response.body,
                  },
              });
          }
      } catch (error) {
          log.error('ERROR MAP Stage', error);
      }
  }
  
    return {
      getInputData: getInputData,
      map: map,
    };
  });
  