/**

 * @NApiVersion 2.0

 * @NModuleScope SameAccount

 * @NScriptType RESTlet

 */

 

define(["N/record", "N/search", "N/log"],

   function (record, search, log) {

    var exports = {};

     const options = new Array("hireDate", "birthDate", "gender", "releaseDate", "maritalStatus", "class", "department", "location", "supervisor", "subsidiary")



     function createOrUpdateEmployee(params) {

       try {

         log.debug("create/update Employee start", "Script is running");

         log.debug("with params", params);

 

         var employee = getEmployee(params.custentityHRId);

         return (employee.id) ? updateEmployee(params, employee.id) : createEmployee(params);

      } catch (error) {

         log.debug("something wrong", error);



         return { statusCode: 401, message: "something is wrong!" + error.message };

      }

    }



     function getEmployee(employeeId) {

       log.debug("employee search", "Searching for existing employee");

 

       var employee = search.create({

         type: record.Type.EMPLOYEE,

         filters: [["custentity_ns_zenhr_employee_id", "is", String(employeeId)]]

       }).run().getRange({ start: 0, end: 1});

       return (!employee[0]) ? false : employee[0];

    }



     function createEmployee(params) {

       log.debug("create", "creating employee");



       var employee = record.create({

        type: record.Type.EMPLOYEE,

         isDynamic: true

       });

       return saveEmployee(employee, params);

    }

 

     function updateEmployee(params, employeeId) {

       log.debug("update", "updating employee");

 

       var employee = record.load({

         type: record.Type.EMPLOYEE,

         id: employeeId,

         isDynamic: true

       });

       return saveEmployee(employee, params);

    }

 

     function saveEmployee(employee, params) {

       for (var key in params) {

         if (params.hasOwnProperty(key)) {

           if (options.indexOf(key) >= 0) {

             employee.setText({ fieldId: key.toLowerCase(), text: params[key] });

           } else if (key == "custentityHRId") {

             employee.setText({ fieldId: "custentity_ns_zenhr_employee_id", text: String(params[key]) });

           } else {

             employee.setValue({ fieldId: key.toLowerCase(), value: params[key] });

           }

         }

      }

       log.debug("saving employee", employee)

       employee.save({ enableSourcing: true, ignoreMandatoryFields: true });

       return { statusCode: 201, message: "Saved Successfully!" };

    }

 

     exports.post = createOrUpdateEmployee;

     return exports;

  });