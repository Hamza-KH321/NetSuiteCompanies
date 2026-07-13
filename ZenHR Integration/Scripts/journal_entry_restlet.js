/**
 * @NApiVersion 2.0
 * @NModuleScope SameAccount
 * @NScriptType RESTlet
 */

define(["N/record", "N/search", "N/log"],
  function (record, search, log) {
    var exports = {};

    function createJournalEntry(params) {
      try {
        log.debug("Create Journal Entries start", "Script is running");
        log.debug("with params", params);
        
        for (var index = 0;  index <  params.journals.length; index++) {
          log.debug("Creating Journal Entry", params.journals[index].name);

          var journalEntry = record.create({
            type: record.Type.JOURNAL_ENTRY,
            isDynamic: true
          })
          
          journalEntry.setText({ fieldId: "subsidiary", text: "Group : " + params.journals[index].subsidiary });
          journalEntry.setText({ fieldId: "trandate", text: params.journals[index].date });
          journalEntry.setValue({ fieldId: "memo", value: params.journals[index].memo });

          for (var line = 0; line < params.journals[index].lines.length; line++) {
            log.debug("Adding Line", params.journals[index].lines[line])

            journalEntry.selectNewLine({ sublistId: "line" });
            for (var field in params.journals[index].lines[line]) {
              log.debug("Adding field", field)

              if (field == "paymentMethod" || field == "employeeInternalId") {
                continue
              } else if (field == "account" || field == "location" || field == "name") {
                journalEntry.setCurrentSublistText({ sublistId: "line", fieldId: field, text: params.journals[index].lines[line][field], ignoreFieldChange: true });
              } else if (field == "department") {
                journalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: field, value: getDepartmentId(params.journals[index].lines[line][field]), ignoreFieldChange: true });
              } else if (field == "debit" || field == "credit") {
                journalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: field, value: params.journals[index].lines[line][field].toFixed(2), ignoreFieldChange: true });
              } else {
                journalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: field, value: params.journals[index].lines[line][field], ignoreFieldChange: true });
              }
            }
            journalEntry.commitLine({ sublistId: "line" });
          }
          log.debug("saving Journal Entry", journalEntry)

          journalEntry.save({ enableSourcing: true, ignoreMandatoryFields: true });
        }
        return { statusCode: 201, message: "Created Successfully!" };
      } catch (error) {
        log.debug("something wrong", error);

        return { statusCode: 401, message: "something is wrong!" + error.message };
      }
    }

    function getDepartmentId(departmentText) {
      var department = search.create({
        type: record.Type.DEPARTMENT,
        filters: [["name", "is", departmentText]]
      }).run().getRange({ start: 0, end: 1});
      return (!department[0]) ? "" : department[0].id;
    }

    exports.post = createJournalEntry;
    return exports;
  });