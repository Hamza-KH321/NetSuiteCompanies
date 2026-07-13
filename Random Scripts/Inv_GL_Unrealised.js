/**
 * Module Description
 * 
 * Version    Date            Author           Remarks
 * 1.00       06 Jun 2022     omarm
 *
 */
function customizeGlImpact(transactionRecord, standardLines, customLines, book)
 {
   var cbx = transactionRecord.getFieldValue('custbody_unrealized_cbx').toString();
   //nlapiSetFieldValue('custbody_unrealized_cbx', 'T');
   //nlapiSetFieldValue ( 'custbody_unrealized_cbx' , 'T' , true , false )
   //var cbx2 = transactionRecord.getFieldValue('custbody_customized_gl').toString();
   //nlapiLogExecution("debug", "cbx2 " + cbx2);
   //custbody_customized_gl
   if(cbx == 'T'){
	try{
		 
var credit = 0 ;
      var debit = 0;
		 		var newLine;

for (var i = 0; i < standardLines.getCount()-1; i++) {

  if (Number(standardLines.getLine(i).getDebitAmount()) > 0 && standardLines.getLine(i).getDebitAmount() != 0) {
    nlapiLogExecution("debug","debit is ",standardLines.getLine(i).getDebitAmount()+" creating credit");

    if (!newLine) {
      newLine = customLines.addNewLine();
    }

    
    newLine.setDebitAmount(standardLines.getLine(0).getDebitAmount());
    newLine.setAccountId(1189);
    nlapiLogExecution("debug","after credit is ",newLine.getCreditAmount()+" ");
    
  }

  if (Number(standardLines.getLine(i).getCreditAmount())> 0 && standardLines.getLine(i).getCreditAmount()!=0) {
    nlapiLogExecution("debug","credit is ",standardLines.getLine(i).getCreditAmount()+" creating debit");

    if (!newLine) {
      newLine = customLines.addNewLine();
    }
    var sum = Number(Math.round(standardLines.getLine(1).getCreditAmount())*100)/100 + Number(Math.round(standardLines.getLine(2).getCreditAmount())*100)/100;
    //newLine.setCreditAmount(Number(Math.round(standardLines.getLine(i).getCreditAmount())*100)/100);
    //newLine.setCreditAmount(Math.round(standardLines.getLine(0).getDebitAmount()*100)/100);
    newLine.setCreditAmount(standardLines.getLine(0).getDebitAmount());
    newLine.setAccountId(124);
    nlapiLogExecution("debug","after debit is ",newLine.getDebitAmount()+" ");
    //debit += Number(Math.round(standardLines.getLine(i).getCreditAmount())*100)/100;
    
  }

  newLine = null;
}
      
var dueDate = transactionRecord.getFieldValue('duedate');
var currentDate = new Date();
const date = currentDate;
const day = ('0' + date.getDate()).slice(-2); // add leading zero if needed
const month = ('0' + (date.getMonth() + 1)).slice(-2); // add leading zero if needed
const year = date.getFullYear();
day = day.toString();
const formattedDate = day+'/'+month+'/'+year ;
//const formattedDate = '22/04/2023' ;

      
/*
var myDate = new Date('Sun Apr 10 2023 06:15:57 GMT-0700 (PDT)');
     var d = new Date(dueDate);
var day = myDate.getDay();
var month = myDate.getMonth() + 1;
var year = myDate.getFullYear();
var formattedDate = ( '10').slice(-2) + '/' + ('0' + month).slice(-2) + '/' + year;
  */
  nlapiLogExecution("debug","Due Date",dueDate);
  nlapiLogExecution("debug","Current Date",currentDate);
  nlapiLogExecution("debug","forma Date",formattedDate);

  if(dueDate <= formattedDate){
    
    nlapiLogExecution("debug","Result","TRUE");
    newLine = customLines.addNewLine();
    newLine.setDebitAmount(standardLines.getLine(0).getDebitAmount());
    newLine.setAccountId(124);
    newLine = customLines.addNewLine();
    newLine.setCreditAmount(standardLines.getLine(0).getDebitAmount());
    newLine.setAccountId(1189);
  }
  else{
    nlapiLogExecution("debug","Result","FALSE");
  }


      }catch(e)
         {
           nlapiLogExecution("error","createdfrom",e.message);
         }
 }//end if
}