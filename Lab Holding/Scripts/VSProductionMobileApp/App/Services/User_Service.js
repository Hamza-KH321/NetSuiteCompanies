/**
 * @NApiVersion 2.1
 * @Filename User_Service.js
 */

define([
    'N/search',
    'N/record',
    'N/file',
    'N/log',
    'N/runtime',
    '../Shared/VSP_Constants.js'
], function (search, record, file, log, runtime, constants) {
    function getUserContext(userId) {
        var fields = search.lookupFields({
            type: constants.USER_RECORD,
            id: userId,
            columns: [
                'name',
                constants.FIELD_USER_EMPLOYEE,
                constants.FIELD_USER_LOCATION,
                constants.FIELD_USER_SUBSIDIARY
            ]
        });

        var employee = firstLookup(fields[constants.FIELD_USER_EMPLOYEE]);
        var location = firstLookup(fields[constants.FIELD_USER_LOCATION]);
        var subsidiary = firstLookup(fields[constants.FIELD_USER_SUBSIDIARY]);
        var employeeInfo = employee.value ? getEmployeeInfo(employee.value) : {};
        var companyInfo = getCompanyLogoUrl(subsidiary.value);

        return {
            id: userId,
            name: employeeInfo.name || fields.name || 'VS Production User',
            email: employeeInfo.email || '',
            employeeId: employee.value || '',
            locationId: location.value || '',
            locationName: location.text || '',
            subsidiaryId: subsidiary.value || '',
            subsidiaryName: subsidiary.text || '',
            companyName: companyInfo.name || subsidiary.text || 'VS Production',
            isSandbox: isSandboxAccount(),
            logoUrl: companyInfo.logoUrl || ''
        };
    }

    function getEmployeeInfo(employeeId) {
        var fields = search.lookupFields({
            type: search.Type.EMPLOYEE,
            id: employeeId,
            columns: ['entityid', 'email']
        });

        return {
            name: fields.entityid || '',
            email: fields.email || ''
        };
    }

    function getCompanyLogoUrl(subsidiaryId) {
        var companyId = runtime.accountId || 'unknown';
        if (companyId.indexOf('_SB') !== -1) {
            companyId = companyId.replace('_SB', '-sb');
        }

        if (!subsidiaryId) {
            return {
                name: 'VS Production',
                logoUrl: ''
            };
        }

        try {
            var subsidiaryRec = record.load({
                type: record.Type.SUBSIDIARY,
                id: subsidiaryId,
                isDynamic: false
            });
            var name = subsidiaryRec.getValue({ fieldId: 'name' });
            var logoFileId = subsidiaryRec.getValue({ fieldId: 'logo' });
            var logoUrl = '';

            if (logoFileId) {
                logoUrl = 'https://' + companyId + '.app.netsuite.com' + file.load({ id: logoFileId }).url;
            }

            return {
                name: name || 'VS Production',
                logoUrl: logoUrl
            };
        } catch (e) {
            log.error('Error loading VS Production subsidiary info', e);
            return {
                name: 'VS Production',
                logoUrl: ''
            };
        }
    }

    function isSandboxAccount() {
        var accountId = String(runtime.accountId || '');
        return accountId.indexOf('_SB') !== -1 ||
            accountId.indexOf('-sb') !== -1 ||
            accountId.toLowerCase().indexOf('sandbox') !== -1;
    }

    function firstLookup(value) {
        if (Array.isArray(value) && value.length) {
            return {
                value: value[0].value || '',
                text: value[0].text || ''
            };
        }

        return {
            value: '',
            text: ''
        };
    }

    return {
        getUserContext: getUserContext
    };
});
