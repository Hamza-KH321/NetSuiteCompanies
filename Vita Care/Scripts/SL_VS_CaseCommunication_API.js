/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/file', 'N/https', 'N/log'],

	function (record, search, file, https, log) {

		/**
		 * Definition of the Suitelet script trigger point.
		 *
		 * @param {Object} context
		 * @param {ServerRequest} context.request - Encapsulation of the incoming request
		 * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
		 * @Since 2015.2
		 */
		function onRequest(context) {

			try {
				if (context.request.headers.token != 'cd7f72c0851d4366a261005b3783908e') {
					context.response.write('wrong token');
					return;
				}

				var request = JSON.parse(context.request.body);
				log.debug('request', request);
				var CaseID = request.CaseID;
				log.debug('CaseID', CaseID);

				var supportcaseSearchObj = search.create({
					type: "supportcase",
					filters: [
						["number", "equalto", CaseID]
					],
					columns: [
						search.createColumn({ name: "casenumber", label: "Number" }),
						search.createColumn({ name: "internalid", label: "Internal ID" })
					]
				});

				var searchResult = supportcaseSearchObj.run().getRange({
					start: 0,
					end: 1
				});

				var internalId;
				if (searchResult.length > 0) {
					internalId = searchResult[0].getValue({ name: 'internalid' });
				} else {
					context.response.write(JSON.stringify({ success: false, message: 'Case not found' }));
					return;
				}

				var caseRecord;
				try {
					caseRecord = record.load({
						type: record.Type.SUPPORT_CASE,
						id: internalId
					});
				} catch (error) {
					log.error('Error loading case record', error);
					context.response.write(JSON.stringify({ success: false, message: 'Error loading case record', error: error.message }));
					return;
				}

				function saveFileFromUrl(url) {
					try {
						var response = https.get({ url: url });
						log.debug('Response from URL', response);

						if (response.code === 200) {
							var fileName = url.split('/').pop();
							log.debug('FileName', fileName);

							var mimeType = response.headers['Content-Type'] || response.headers['content-type'];
							var fileType;

							switch (mimeType) {
								case 'text/plain':
									fileType = file.Type.PLAINTEXT;
									break;
								case 'application/pdf':
									fileType = file.Type.PDF;
									break;
								case 'image/jpeg':
									fileType = file.Type.JPEGIMAGE;
									break;
								case 'image/jpg':
									fileType = file.Type.JPGIMAGE;
									break;
								case 'image/png':
									fileType = file.Type.PNGIMAGE;
									break;
								case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
									fileType = file.Type.EXCEL;
									break;
								case 'application/msword':
									fileType = file.Type.WORD;
									break;
								case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
									fileType = file.Type.WORD;
									break;
								case 'application/vnd.ms-excel':
									fileType = file.Type.EXCEL;
									break;
								default:
									log.error('Unsupported file type', mimeType);
									return null;
							}

							var fileObj = file.create({
								name: fileName,
								fileType: fileType, // Adjust the file type based on the actual file content
								contents: response.body,
								folder: -4 // Replace with the internal ID of the desired folder in the File Cabinet
							});
							log.debug('File Object', fileObj);

							var fileId = fileObj.save();
							return fileId;
						} else {
							log.error('Error fetching file', 'Failed to fetch file from URL: ' + url + ' with response code: ' + response.code);
							return null;
						}
					} catch (error) {
						log.error('Error in saveFileFromUrl', error.message);
						return null;
					}
				}

				caseRecord.setValue({ fieldId: 'messagenew', value: true });

				if (request.hasOwnProperty('Message'))
					caseRecord.setValue({ fieldId: 'incomingmessage', value: request.Message });

				if (request.hasOwnProperty('CaseID'))
					caseRecord.setValue({ fieldId: 'casenumber', value: request.CaseID });

				// if (request.hasOwnProperty('id'))
				// 	caseRecord.setValue({ fieldId: 'id', value: request.id });

				if (request.hasOwnProperty('Attachment')) {
					var fileId = saveFileFromUrl(request.Attachment);
					if (fileId) {
						caseRecord.setValue({ fieldId: 'custevent_vc_pmt_meth', value: fileId }); // Replace 'custevent_vc_pmt_meth' with the correct field ID
					} else {
						log.error('Error saving attachment', 'Failed to save the attachment from URL: ' + request.Attachment);
					}
				}

				if (request.hasOwnProperty('status'))
					caseRecord.setValue({ fieldId: 'status', value: request.status });

				caseRecord.setValue({ fieldId: 'author', value: 58597 });

				var caseId = caseRecord.save({ enableSourcing: true, ignoreMandatoryFields: true });

				log.debug('Case is Saved with ID:', caseId);
				var response = {
					code: 200,
					status: "SUCCESS",
					message: 'Case Updated with ID of ' + caseId,
					caseId: caseRecord.casenumber,
					id: caseRecord.id
				};

				context.response.write(JSON.stringify(response));

			} catch (e) {
				log.error('Suitelet error', e);
				context.response.write(JSON.stringify(e));
			}

		}

		return {
			onRequest: onRequest
		};

	});
