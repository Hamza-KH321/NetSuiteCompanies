function userEventBeforeSubmit(type){

	var itemCount = nlapiGetLineItemCount('item');	
	for (var i=1;i<=itemCount;i++){			
		
		// get Item Id
		var itemId = nlapiGetLineItemValue('item','item',i);
		
        // get item type
		var itemType = nlapiGetLineItemValue('item', 'itemtype', i);
		var recordType = '';	
		  	         nlapiLogExecution("DEBUG", "itemType", itemType);
        switch (itemType) {   // Compare item type to its record type counterpart
            case 'InvtPart':
            	recordType = 'inventoryitem';
                break;
            case 'NonInvtPart':
            	recordType = 'noninventoryitem';
                break;
            case 'Service':
            	recordType = 'serviceitem';
                break;
            case 'Assembly':
            	recordType = 'assemblyitem';
                break;                
            case 'GiftCert':
            	recordType = 'giftcertificateitem';
                break;
            default:
       }		

		// load item and get image file from Item Display Thumbnail
		var item = nlapiLoadRecord(recordType,itemId);	
      nlapiLogExecution("DEBUG", "Item", item);
		var imgFileId = item.getFieldValue('storedisplayimage');	
      nlapiLogExecution("DEBUG", "image", imgFileId);
		// if it has image - continue
		if (imgFileId) {
			var file = nlapiLoadFile(imgFileId);
			// printed file must be available without login, otherwise you get error on printing 
			if (file.isOnline()){
              nlapiLogExecution("DEBUG", "File Online", "");
				var imageUrl = file.getURL();
               nlapiLogExecution("DEBUG", "Image URL", imageUrl);
				// complete url
				var completeUrl = 'https://system.netsuite.com' + imageUrl;
				// set completed url to your custom field of type free-form-text
				nlapiSetLineItemValue('item','custcol_vs_itemimage',i,completeUrl);
			}
		}
	}
}
