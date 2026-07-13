/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/format', 'N/log'],
  function (format, log) {

    function afterSubmit(context) {
      if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
        return; // Only process after record creation or editing
      }

      var today = new Date();
      var todayPlus20Days = new Date(today);
      todayPlus20Days.setDate(today.getDate() + 20);

      var totalDaysDifference = dateDifferenceInDays(todayPlus20Days, today);

      log.debug('Today\'s Date:', format.format({ value: today, type: format.Type.DATE }));
      log.debug('Today\'s Date + 20 Days:', format.format({ value: todayPlus20Days, type: format.Type.DATE }));
      log.debug('Difference (in days):', totalDaysDifference);
    }

    function dateDifferenceInDays(date1, date2) {
      // Convert both dates to milliseconds
      var date1_ms = date1.getTime();
      var date2_ms = date2.getTime();

      // Calculate the difference in milliseconds
      var difference_ms = date2_ms - date1_ms;

      // Convert back to days and return
      return Math.round(difference_ms / (1000 * 60 * 60 * 24));
    }

    return {
      afterSubmit: afterSubmit
    };

  });
