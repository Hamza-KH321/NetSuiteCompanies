/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/search'],
   /**
    * @param {search} search
    */
   function (search) {

      /**
       * Definition of the Suitelet script trigger point.
       *
       * @param {Object} context
       * @param {ServerRequest} context.request - Encapsulation of the incoming request
       * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
       * @Since 2015.2
       */
      function onRequest(context) {

         //var itemID = context.request.parameters.item;
         var itemJSON = new Object();
         var itemArr = new Array();
         var invfull;
         var token = "jg6546v16vfr4t98dr4t6h";
         var userToken = context.request.headers.token;

         if (userToken != token) {
            context.response.write(JSON.stringify({
               "Success": "False",
               "Message": "Invalid Token"
            }));

            return;
         }


         var inv = search.create({
            type: "inventorybalance",
            filters:
               [
                  //["item.name","is",itemID]
               ],
            columns:
               [
                  search.createColumn({
                     name: "item",
                     summary: "GROUP",
                     label: "Item"
                  }),
                  search.createColumn({
                     name: "salesdescription",
                     join: "item",
                     summary: "GROUP",
                     label: "Description"
                  }),
                  search.createColumn({
                     name: "location",
                     summary: "GROUP",
                     label: "Warehouse"
                  }),
                  search.createColumn({
                     name: "available",
                     summary: "SUM",
                     label: "Available"
                  }),
                  search.createColumn({
                     name: "isinactive",
                     join: "item",
                     summary: "GROUP",
                     label: "Inactive"
                  }),
                  search.createColumn({
                     name: "custitem_vc_publicprice",
                     join: "item",
                     summary: "GROUP",
                     label: "Public Price"
                  }),
                  search.createColumn({
                     name: "internalid",
                     join: "location",
                     summary: "GROUP",
                     label: "WarehouseID"
                  })
                  //   ,
                  //   search.createColumn({
                  //    name: "custrecord_celigo_mag2_item_id",
                  //    join: "warehouse",
                  //    summary: "GROUP",
                  //    label: "Magento Item Id"
                  // })

                  //   ,
                  //   search.createColumn({
                  //      name: "custrecord_vs_magentoid",
                  //      join: "location",
                  //      summary: "GROUP",
                  //      label: "Magento ID"
                  //   })
               ]
         }).run().getRange({ start: 0, end: 1000 });

         invfull = inv;
         var start = 1000;
         var end = 2000;
         while (inv.length == 1000) {
            var inv = search.create({
               type: "inventorybalance",
               filters:
                  [
                     //["item.name","is",itemID]
                  ],
               columns:
                  [
                     search.createColumn({
                        name: "item",
                        summary: "GROUP",
                        label: "Item"
                     }),
                     search.createColumn({
                        name: "salesdescription",
                        join: "item",
                        summary: "GROUP",
                        label: "Description"
                     }),
                     search.createColumn({
                        name: "location",
                        summary: "GROUP",
                        label: "Warehouse"
                     }),
                     search.createColumn({
                        name: "available",
                        summary: "SUM",
                        label: "Available"
                     }),
                     search.createColumn({
                        name: "isinactive",
                        join: "item",
                        summary: "GROUP",
                        label: "Inactive"
                     }),
                     search.createColumn({
                        name: "custitem_vc_publicprice",
                        join: "item",
                        summary: "GROUP",
                        label: "Public Price"
                     }),
                     search.createColumn({
                        name: "internalid",
                        join: "location",
                        summary: "GROUP",
                        label: "WarehouseID"
                     })
                     //   ,
                     //   search.createColumn({
                     //    name: "custrecord_celigo_mag2_item_id",
                     //    join: "warehouse",
                     //    summary: "GROUP",
                     //    label: "Magento Item Id"
                     // })
                     //   ,
                     //   search.createColumn({
                     //      name: "custrecord_vs_magentoid",
                     //      join: "location",
                     //      summary: "GROUP",
                     //      label: "Magento ID"
                     //   })
                  ]
            }).run().getRange({ start: start, end: end });

            start = start + 1000;
            end = end + 1000;
            invfull = invfull.concat(inv);
         }

         for (var i = 0; i < invfull.length; i++) {
            var itemJSON = new Object();

            itemJSON.item = invfull[i].getText({ name: "item", summary: "GROUP" });
            itemJSON.name = invfull[i].getValue({ name: "salesdescription", join: "item", summary: "GROUP" });
            itemJSON.warehouse = invfull[i].getText({ name: "location", summary: "GROUP" });
            itemJSON.status = invfull[i].getValue({ name: "isinactive", join: "item", summary: "GROUP" });
            itemJSON.publicPrice = invfull[i].getValue({ name: "custitem_vc_publicprice", join: "item", summary: "GROUP" });
            // itemJSON.magentoID = invfull[i].getValue({name: "custrecord_vs_magentoid",join: "location" ,summary: "GROUP"});
            itemJSON.available = Number(invfull[i].getValue({ name: "available", summary: "SUM" }));
            itemJSON.WarehouseID = Number(invfull[i].getValue({ name: "internalid", join: "location", summary: "GROUP" }));

            itemArr.push(itemJSON);
         }
         itemJSON = itemArr
         context.response.write(JSON.stringify(itemJSON));


      }

      return {
         onRequest: onRequest
      };

   });
