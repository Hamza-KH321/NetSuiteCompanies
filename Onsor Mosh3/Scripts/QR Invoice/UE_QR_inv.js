/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/encode', 'N/record', 'N/currentRecord', 'N/format', 'N/log'],
  /**
   * @param {encode} encode
   * @param {record} record
   */
  function (encode, record, currentRecord, format, log) {

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
     */
    function beforeLoad(scriptContext) {

    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function beforeSubmit(scriptContext) {

    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function afterSubmit(scriptContext) {

      //    	01_seller name
      //    	02_vatNum
      //		03_DateTime 2022-04-25T15:30:00Z
      //      04_InvoiceAmount
      //		05_VATAmount
      if (scriptContext.type != scriptContext.UserEventType.DELETE) {
        var thisRecord = scriptContext.newRecord;
        var recordType = thisRecord.type; // Get the record type

        // log.debug();


        var sellerName = thisRecord.getValue('subsidiary');

        log.debug('sellerName', sellerName)

        var sellerName_hex = encode.convert({
          string: sellerName,
          inputEncoding: encode.Encoding.UTF_8,
          outputEncoding: encode.Encoding.HEX
        });

        var length01 = sellerName.length;

        var length01_hex = length01.toString(16);

        if (length01_hex.length < 2)
          length01_hex = '0' + length01_hex;



          var vatNum = '301238868700003';

        var vatNum_hex = encode.convert({
          string: vatNum,
          inputEncoding: encode.Encoding.UTF_8,
          outputEncoding: encode.Encoding.HEX
        });

        var length02 = vatNum.length;

        var length02_hex = length02.toString(16)

        if (length02_hex.length < 2)
          length02_hex = '0' + length02_hex;


        var dateParsed = format.format({
          value: thisRecord.getValue('trandate'),
          type: format.Type.DATE
        });
        var timeOfTheDay = thisRecord.getValue('custbody_vs_timeoftheday');

        if (timeOfTheDay) {
          var timeParsed = format.parse({
            value: thisRecord.getValue('custbody_vs_timeoftheday'),
            type: format.Type.TIME
          });
        }
        else
          timeParsed = '00:00'

        var timeParsed = format.format({
          value: timeParsed,
          type: format.Type.TIME
        });

        var timeSplitted = timeParsed.split(':');

        //   var time = (Number(timeSplitted[0])<10 && timeSplitted[0] !='00' ?'0'+timeSplitted[0]:timeSplitted[0])+':'+(Number(timeSplitted[1])<10 && timeSplitted[1] !='00'?'0'+timeSplitted[1]:timeSplitted[1])+':00'


        var time = (Number(timeSplitted[0]) < 10 && timeSplitted[0] != '00' ? '' + timeSplitted[0] : timeSplitted[0]) + ':' + (Number(timeSplitted[1]) < 10 && timeSplitted[1] != '00' ? '' + timeSplitted[1] : timeSplitted[1]) + ':00'


        var DateTime = dateParsed + ' ' + time;

        var DateTime_hex = encode.convert({
          string: DateTime,
          inputEncoding: encode.Encoding.UTF_8,
          outputEncoding: encode.Encoding.HEX
        });


        var length03 = DateTime.length;

        var length03_hex = length03.toString(16)

        if (length03_hex.length < 2)
          length03_hex = '0' + length03_hex;

        var InvTotal = thisRecord.getValue('total') + '';

        var InvTotal_hex = encode.convert({
          string: InvTotal,
          inputEncoding: encode.Encoding.UTF_8,
          outputEncoding: encode.Encoding.HEX
        });


        var length04 = InvTotal.length;

        var length04_hex = length04.toString(16)

        if (length04_hex.length < 2)
          length04_hex = '0' + length04_hex;


        var VATAmt = thisRecord.getValue('taxtotal') + '';

        var VATAmt_hex = encode.convert({
          string: VATAmt,
          inputEncoding: encode.Encoding.UTF_8,
          outputEncoding: encode.Encoding.HEX
        });

        var length05 = VATAmt.length

        var length05_hex = length05.toString(16)

        if (length05_hex.length < 2)
          length05_hex = '0' + length05_hex;
        log.debug(thisRecord.getValue('type'));



        var base64 = encode.convert({
          string: '01' + length01_hex + sellerName_hex + '02' + length02_hex + '' + vatNum_hex + ''
            + '03' + length03_hex + DateTime_hex + '04' + length04_hex + InvTotal_hex
            + '05' + length05_hex + VATAmt_hex,
          inputEncoding: encode.Encoding.HEX,
          outputEncoding: encode.Encoding.BASE_64
        });
        log.debug('base64', base64);
        var recordId = record.submitFields({
          type: recordType,
          id: thisRecord.id,
          values: {
            'custbody_vs_qrcode': base64
          }
        });


        /*   thisRecord.setValue({fieldId:'custbody38',value:('01'+length01+sellerName+'02'+length02+vatNum
               +'03'+length03+DateTime+'04'+length04
               +'05'+length05+VATAmt)}); 
         */
        //    	01_seller name
        //    	02_vatNum
        //		03_DateTime 2022-04-25T15:30:00Z
        //      04_InvoiceAmount
        //		05_VATAmount
      }

    }

    return {
      beforeLoad: beforeLoad,
      beforeSubmit: beforeSubmit,
      afterSubmit: afterSubmit
    };

  });
