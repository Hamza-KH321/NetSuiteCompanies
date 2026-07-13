/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/search', 'N/ui/dialog', 'N/log'], function (currentRecord, search, dialog, log) {

  // Cache account -> mandatory flags to avoid repeated lookups
  var accountFlagsCache = {};

  function toBool(v) {
    // covers true/false, 'T'/'F', 'true'/'false', 1/0, etc.
    if (v === true || v === 'T' || v === 'true' || v === 1 || v === '1') return true;
    return false;
  }

  function getAccountFlags(accountId) {
    if (!accountId) return null;
    if (accountFlagsCache[accountId]) return accountFlagsCache[accountId];

    var flags = {
      requireClass: false,
      requireDepartment: false,
      requireName: false,
      requireLocation: false
    };

    try {
      var res = search.lookupFields({
        type: 'account',
        id: accountId,
        columns: [
          'custrecord_vs_mandatory_class',
          'custrecord_vs_mandatory_department',
          'custrecord_vs_mandatory_name',
          'custrecord_vs_mandatory_location'
        ]
      });

      flags.requireClass      = toBool(res.custrecord_vs_mandatory_class);
      flags.requireDepartment = toBool(res.custrecord_vs_mandatory_department);
      flags.requireName       = toBool(res.custrecord_vs_mandatory_name);
      flags.requireLocation   = toBool(res.custrecord_vs_mandatory_location);

      accountFlagsCache[accountId] = flags;
    } catch (e) {
      log.error('lookup account flags failed', e);
      // if lookup fails, default to allowing the line
      return null;
    }
    return flags;
  }

  function validateLine(context) {
    try {
      if (context.sublistId !== 'line') return true;

      var rec = currentRecord.get();

      var accountId  = rec.getCurrentSublistValue({ sublistId: 'line', fieldId: 'account' });
      if (!accountId) return true; // no account yet; allow user to continue editing

      var flags = getAccountFlags(accountId);
      if (!flags) return true; // if we couldn't read flags, don't block

      // Current line values
      var classId     = rec.getCurrentSublistValue({ sublistId: 'line', fieldId: 'class' });
      var deptId      = rec.getCurrentSublistValue({ sublistId: 'line', fieldId: 'department' });
      var entityId    = rec.getCurrentSublistValue({ sublistId: 'line', fieldId: 'entity' });   // "Name" column
      var locationId  = rec.getCurrentSublistValue({ sublistId: 'line', fieldId: 'location' });

      var missing = [];

      if (flags.requireClass && !classId)       missing.push('Class');
      if (flags.requireDepartment && !deptId)   missing.push('Department');
      if (flags.requireName && !entityId)       missing.push('Name');
      if (flags.requireLocation && !locationId) missing.push('Location');

      if (missing.length) {
        // Show a clear red-style alert and block the line commit
        dialog.alert({
          title: 'Missing Required Fields',
          message: 'Based on the selected Account, the following fields are mandatory on this line: ' +
                   missing.join(', ') + '. Please fill them before adding the line.'
        });
        return false; // prevent committing the line
      }

      return true; // all good, allow commit
    } catch (e) {
      log.error('validateLine error', e);
      // fail open to avoid blocking users due to unexpected errors
      return true;
    }
  }

  return {
    validateLine: validateLine
  };
});
