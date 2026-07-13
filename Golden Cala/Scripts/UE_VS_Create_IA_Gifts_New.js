/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/email', 'N/format', 'N/url'],
  function (record, search, email, format, url) {

    function afterSubmit(context) {
      try {
        if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
          return;
        }

        var newRecord = context.newRecord;
        var rectype = 'customrecord_vs_giftstrans';
        var recid = newRecord.id;

        var loadedRecord = record.load({
          type: rectype,
          id: recid,
          isDynamic: true
        });

        var internalID = loadedRecord.getValue({ fieldId: "recordid" });
        var date = loadedRecord.getValue({ fieldId: "custrecord_vs_date_new" });
        var location = loadedRecord.getValue({ fieldId: "custrecord_vs_location_new" });
        var headerNotes = loadedRecord.getValue({ fieldId: "custrecord_vs_notes_new" });
        var IACreated = loadedRecord.getValue({ fieldId: "custrecord_vs_iacreatedsuccessfully" });
        var custForm = loadedRecord.getValue({ fieldId: "customform" });
        var itemCount = loadedRecord.getLineCount({ sublistId: "recmachcustrecord_vs_parent_new" });
        var approvalStatus = loadedRecord.getValue({ fieldId: "custrecord_vs_giftapprovalstatus" });

        if (custForm == '186') {
          approvalStatus = 2;
        }

        if (approvalStatus == 2 && !IACreated) {
          var inventoryAdjustment = record.create({
            type: record.Type.INVENTORY_ADJUSTMENT,
            isDynamic: true,
          });

          inventoryAdjustment.setValue({ fieldId: "customform", value: 148 });
          inventoryAdjustment.setValue({ fieldId: "subsidiary", value: 2 });
          inventoryAdjustment.setValue({ fieldId: "custbody_vs_source", value: 'Gifts - ' + internalID });
          inventoryAdjustment.setValue({ fieldId: "memo", value: headerNotes });

          var accountMap = { '77': '816', '79': '833', '78': '767', '76': '798', '186': '800' };
          inventoryAdjustment.setValue({ fieldId: "account", value: accountMap[custForm] || '' });

          inventoryAdjustment.setValue({ fieldId: "trandate", value: date });
          inventoryAdjustment.setValue({ fieldId: "adjlocation", value: location });

          var itemQtyMap = {}; // Store itemId -> required qty

          for (var i = 0; i < itemCount; i++) {
            var itemId = loadedRecord.getSublistValue({ sublistId: "recmachcustrecord_vs_parent_new", fieldId: "custrecord_vs_item_new", line: i });
            var qty = loadedRecord.getSublistValue({ sublistId: "recmachcustrecord_vs_parent_new", fieldId: "custrecord_vs_quantity_new", line: i });
            itemQtyMap[itemId] = (itemQtyMap[itemId] || 0) + qty;
          }

          var lotNumberMap = getAvailableLotNumbers(itemQtyMap, location);

          for (var j = 0; j < itemCount; j++) {
            var itemIdLine = loadedRecord.getSublistValue({ sublistId: "recmachcustrecord_vs_parent_new", fieldId: "custrecord_vs_item_new", line: j });
            var qtyLine = loadedRecord.getSublistValue({ sublistId: "recmachcustrecord_vs_parent_new", fieldId: "custrecord_vs_quantity_new", line: j });
            var memoLine = loadedRecord.getSublistValue({ sublistId: "recmachcustrecord_vs_parent_new", fieldId: "custrecord_vs_memoline_new", line: j });

            inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "item", value: itemIdLine });
            inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "location", value: location });
            inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "adjustqtyby", value: -qtyLine });
            inventoryAdjustment.setCurrentSublistValue({ sublistId: "inventory", fieldId: "memo", value: memoLine });

            assignLotNumbers(inventoryAdjustment, itemIdLine, qtyLine, lotNumberMap[itemIdLine] || []);
            inventoryAdjustment.commitLine({ sublistId: "inventory" });
          }

          var adjustmentId = inventoryAdjustment.save();
          loadedRecord.setValue({ fieldId: 'custrecord_vs_iacreatedsuccessfully', value: true });
          loadedRecord.save();

          // ===== Build dynamic link =====
          var relativeLink = url.resolveRecord({
            recordType: record.Type.INVENTORY_ADJUSTMENT,
            recordId: adjustmentId,
            isEditMode: false
          });
          var domain = url.resolveDomain({ hostType: url.HostType.APPLICATION });
          var fullLink = 'https://' + domain + relativeLink;

          // ===== Send Email =====
          try {
            var recipients = getRecipientsByLocation(String(location));
            if (recipients && recipients.length) {
              var subject = 'Inventory Adjustment Created for Gifts - ' + internalID + ' (IA #' + adjustmentId + ')';
              var body =
                '<p>Hello,</p>' +
                '<p>An Inventory Adjustment has been created from the Gifts transaction.</p>' +
                '<p><b>Details:</b><br/>' +
                'Gifts Record (Internal): ' + internalID + '<br/>' +
                'Inventory Adjustment ID: ' + adjustmentId + '<br/>' +
                'Location ID: ' + location + '<br/>' +
                'Lines: ' + itemCount + '<br/>' +
                (headerNotes ? ('Notes: ' + headerNotes + '<br/>') : '') +
                'Link: <a href="' + fullLink + '" target="_blank">View Inventory Adjustment</a>' +
                '</p><p>Regards,<br/>System</p>';

              email.send({
                author: 6774,
                recipients: recipients,
                subject: subject,
                body: body,
                relatedRecords: { transactionId: adjustmentId }
              });
            }
          } catch (mailErr) {
            log.error({ title: 'Email Send Failed', details: mailErr });
          }
        }
      } catch (error) {
        log.error({ title: 'ERROR!!!!', details: error });
      }
    }

    function getAvailableLotNumbers(itemQtyMap, location) {
      var itemIds = Object.keys(itemQtyMap);
      var searchResults = search.create({
        type: "inventorynumber",
        filters: [
          ["quantityavailable", "greaterthan", "0"],
          "AND", ["item", "anyof"].concat(itemIds),
          "AND", ["location", "anyof", location],
          "AND", ["inventorynumber", "doesnotcontain", "-D"],
          "AND", ["inventorynumber", "doesnotcontain", "-1"],
          "AND", ["inventorynumber", "doesnotcontain", "-AS"]
        ],
        columns: ["inventorynumber", "quantityavailable", "internalid", "item"]
      }).run().getRange({ start: 0, end: 1000 });

      var lotNumberMap = {};
      searchResults.forEach(function (result) {
        var itemId = result.getValue("item");
        var lotId = result.getValue("internalid");
        var availableQty = parseFloat(result.getValue("quantityavailable"));
        if (!lotNumberMap[itemId]) lotNumberMap[itemId] = [];
        lotNumberMap[itemId].push({ lotId: lotId, availableQty: availableQty });
      });
      return lotNumberMap;
    }

    function assignLotNumbers(inventoryAdjustment, itemId, qty, lotArray) {
      var totalAssigned = 0;
      for (var i = 0; i < lotArray.length && totalAssigned < qty; i++) {
        var lot = lotArray[i];
        var assignQty = Math.min(qty - totalAssigned, lot.availableQty);
        inventoryAdjustment.getCurrentSublistSubrecord({ sublistId: 'inventory', fieldId: 'inventorydetail' })
          .selectNewLine({ sublistId: 'inventoryassignment' })
          .setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: -assignQty })
          .setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', value: lot.lotId })
          .commitLine({ sublistId: 'inventoryassignment' });
        totalAssigned += assignQty;
      }
    }

    function getRecipientsByLocation(locationIdStr) {
      var map = {
        '10': [1670, -5], '23': [1670, -5], '24': [1670, -5],
        '15': ['wh-east@goldencala.com'], '19': ['wh-east@goldencala.com'], '20': ['wh-east@goldencala.com'],
        '8': [1626], '16': [1626], '18': [1626],
        '25': [1638], '26': [1638], '27': [1638],
        '12': [1654], '21': [1654], '22': [1654]
      };
      return map[locationIdStr] || [];
    }

    return { afterSubmit: afterSubmit };
  });
