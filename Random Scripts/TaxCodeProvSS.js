/**
 * Copyright © 2015, 2017, Oracle and/or its affiliates. All rights reserved.
 */

function runTaxProvisioning() {
    var nexusId = nlapiGetContext().getSetting('SCRIPT', 'custscript_taxcode_nexus');
    var nexusCountry = getNexusCountryById(nexusId);
    if (nexusCountry) {
        nlapiLogExecution('AUDIT', 'Run Tax code provisioning SS for nexus - ' + nexusCountry);
        new VAT.TaxProvisioning(nexusCountry, true).run();
    } else {
        nlapiLogExecution('AUDIT', 'Tax codes not provisioned, Tax Code Nexus is not set');
    }
}

function getNexusCountryById(id) {
    var nexusCountry = '';

    try {
        var nexusRec = nlapiLoadRecord('nexus', id);
        if (nexusRec) {
            nexusCountry = nexusRec.getFieldValue('country');
        }
    } catch (ex) {
        nlapiLogExecution('AUDIT', 'Tax codes not provisioned, unable to retrieve nexus with id=' + id);
    }

    return nexusCountry;
}
