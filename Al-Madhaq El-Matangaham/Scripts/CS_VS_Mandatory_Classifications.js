/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @fileName CS || Mandatory Classifications
 */
define(['N/currentRecord', 'N/search', 'N/ui/dialog', 'N/log'], function (currentRecord, search, dialog, log) {

  var accountTypeCache = {};

  function getAccountType(accountId) {
    if (!accountId) {
      return null;
    }

    if (accountTypeCache[accountId]) {
      return accountTypeCache[accountId];
    }

    try {
      var result = search.lookupFields({
        type: 'account',
        id: accountId,
        columns: ['type']
      });

      var accountType = null;

      if (result.type && result.type.length > 0) {
        accountType = result.type[0].value;
      }

      accountTypeCache[accountId] = accountType;
      log.debug('Account Type Cached', accountType);

      return accountType;

    } catch (e) {
      log.error('getAccountType error', e);
      return null;
    }
  }

  function fieldChanged(context) {
    try {
      if (context.sublistId !== 'line' || context.fieldId !== 'account') {
        return;
      }

      var rec = currentRecord.get();

      var accountId = rec.getCurrentSublistValue({ sublistId: 'line', fieldId: 'account' });

      if (!accountId) {
        return;
      }

      var accountType = getAccountType(accountId);
      if (!accountType) {
        return;
      }

      // ✅ Set Tax Code based on Account Type
      if (accountType === 'Expense') {
        rec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'tax1acct', value: 126, ignoreFieldChange: true });
        log.debug('Tax Code Set', 'Expense → 6');
      }

      if (accountType === 'Income') {
        rec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'tax1acct', value: 125, ignoreFieldChange: true });
        log.debug('Tax Code Set', 'Income → 15');
      }

    } catch (e) {
      log.error('fieldChanged error', e);
    }
  }

  function validateLine(context) {
    try {
      if (context.sublistId !== 'line') {
        return true;
      }

      var rec = currentRecord.get();

      var accountId = rec.getCurrentSublistValue({ sublistId: 'line', fieldId: 'account' });

      if (!accountId) {
        return true;
      }

      var accountType = getAccountType(accountId);
      if (!accountType) {
        return true;
      }

      if (accountType !== 'Income' && accountType !== 'Expense' && accountType !== 'FixedAsset') {
        log.debug('Skipping validation', accountType);
        return true;
      }

      var classId = rec.getCurrentSublistValue({ sublistId: 'line', fieldId: 'class' });
      var deptId = rec.getCurrentSublistValue({ sublistId: 'line', fieldId: 'department' });
      var locationId = rec.getCurrentSublistValue({ sublistId: 'line', fieldId: 'location' });

      var missing = [];

      if (!classId) missing.push('Class');
      if (!deptId) missing.push('Department');
      if (!locationId) missing.push('Location');

      if (missing.length > 0) {
        dialog.alert({
          title: 'Missing Required Fields',
          message:
            'For Income / Expense / Fixed Asset accounts, the following fields are mandatory: ' +
            missing.join(', ') +
            '. Please complete them before adding the line.'
        });
        return false;
      }

      return true;

    } catch (e) {
      log.error('validateLine error', e);
      return true;
    }
  }

  return {
    fieldChanged: fieldChanged,
    validateLine: validateLine
  };
});
