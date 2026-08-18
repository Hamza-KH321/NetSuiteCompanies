/**
 * Module Description
 * 
 * Version    Date            Author           Remarks
 * 1.00       06 Jun 2024     Alaa
 *
 */
function customizeGlImpact(transactionRecord, standardLines, customLines, book) {
	try {

		var lineCount = transactionRecord.getLineItemCount('item');
		nlapiLogExecution("debug", 'lineCount', lineCount);

		for (var i = 1; i <= lineCount; i++) {
			var accs = nlapiLookupField("item", transactionRecord.getLineItemValue('item', 'item', i), "incomeaccount");
			var rate = transactionRecord.getLineItemValue('item', 'custcol_vsrateafterdiscount', i);
			var rateAftreDiscount = transactionRecord.getLineItemValue('item', 'rate', i);
			var dis = transactionRecord.getLineItemValue('item', 'custcol_vs_discountrate', i);
			var Brand = transactionRecord.getLineItemValue('item', 'class_display', i);
			var classId = transactionRecord.getLineItemValue('item', 'class', i);
			var department = transactionRecord.getFieldValue('csegvs_dep');
			var Location = transactionRecord.getFieldValue('location');

			try {
				// Load the record (e.g., a class record)
				var classRecord = nlapiLoadRecord('classification', classId);
				var internalId = classRecord.getId();

				nlapiLogExecution('DEBUG', 'Internal ID', internalId);
			} catch (e) {
				nlapiLogExecution('ERROR', 'Error Loading Record', e.toString());
			}

			if (dis > 0) {
				var newLine1 = customLines.addNewLine();
				newLine1.setCreditAmount(dis);
				newLine1.setAccountId(parseInt(accs));
				newLine1.setClassId(parseInt(classId));
				newLine1.setMemo("Sales Revenue");

				nlapiLogExecution("DEBUG", "Added Credit Line", {
					account: accs,
					amount: dis,
					brand: Brand,
					classId: classId
				});

				var newLine2 = customLines.addNewLine();
				newLine2.setDebitAmount(dis);
				newLine2.setAccountId(293);
				newLine2.setClassId(parseInt(classId));
				newLine2.setMemo("Discount");

				nlapiLogExecution("DEBUG", "Added Debit Line", {
					account: 293,
					amount: dis,
					brand: Brand,
					classId: classId
				});
			}
		}

	} catch (e) {
		nlapiLogExecution("debug", e, e);
	}

}
