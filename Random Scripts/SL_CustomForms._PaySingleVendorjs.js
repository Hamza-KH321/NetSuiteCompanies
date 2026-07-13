/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/file','N/email', 'N/record', 'N/redirect', 'N/ui/serverWidget', 'N/render','N/search','N/https'],
/**
 * @param {email} email
 * @param {record} record
 * @param {redirect} redirect
 * @param {serverWidget} serverWidget
 * @param {render} render
 * @param {file} file
 */
function(file ,email, record, redirect, serverWidget, render,search,https) {	
	function onRequest(context) {
    try {
      
      var request = context.request;
      var response = context.response;
    	
      var id1 = request.parameters.id;
      log.debug('id1', id1);
         //id = 3;
        if(! id1) {
            response.write('custom_id parameter missing');
        }

      var rec = record.load({
                type: record.Type.VENDOR_PAYMENT,
                id: 33749,
                isDynamic: true
            });  
      log.debug('rec',rec);
      
      
      var renderer = render.create();
      var template = file.load('SuiteScripts/PaySinglVendor.xml');
      renderer.templateContent= template.getContents();
      renderer.addRecord('record', rec);

      
//    var customrecord42SearchObj = search.create({
//    type: "customrecord42",
//    filters:
//    [
//      //'custrecord3','anyof', id
//    ],
//    columns:
//    [
//       search.createColumn({name: "custrecord2", label: "Type"}),
//       search.createColumn({name: "custrecord1", label: "Percentage"})
//    ]
// });
      
//       var searchResults = customrecord42SearchObj.run().getRange({start:0,end:100})    
//       var milestones = []
     
//       for(var i = 0  ; i < searchResults.length ; i++)
//         {
//            milestone = {
//            type:  searchResults[i].getText('custrecord2'),
//            percent:  searchResults[i].getValue('custrecord1')
//            }
          
//           milestones.push(milestone);
//         }

//       var datasource = {
//         milestones : milestones
//       }
//           	renderer.addCustomDataSource({
//     		format : render.DataSource.OBJECT,
//     		alias : 'miles',
//     		data : datasource
//     	});
      
        var xml = renderer.renderAsString();
       // var pdf = renderer.renderAsPdf(); 
      //  response.setContentType('PDF', 'PO.pdf', 'inline');
    //   response.setContentType('PDF', 'itemlabel.pdf', 'inline');

      context.response.renderPdf(xml);

      //response.write(xml);
        //we still need to find invoice page title

    } catch(err) {
        response.write(err + ' (line number: ' + err.lineno + ')');
        return;
    }
	}
    return {
        onRequest: onRequest
    };
	
});