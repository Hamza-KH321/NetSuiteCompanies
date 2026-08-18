/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @fileName MR || Update Consignment SO Location
 */
define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {
        try {
            log.debug('START', 'Getting Consignment Sales Orders');

            var salesorderSearchObj = search.create({
                type: 'salesorder',
                settings: [
                    {
                        name: 'consolidationtype',
                        value: 'ACCTTYPE'
                    }
                ],
                filters: [
                    ['type', 'anyof', 'SalesOrd'],
                    'AND',
                    ['custbody_vs_consignment_order', 'is', 'T'],
                    'AND',
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['status', 'noneof', 'SalesOrd:C', 'SalesOrd:H'],
                    'AND',
                    ['custbody_vs_consignment_inventory_tran', 'noneof', '@NONE@'],
                    // "AND",
                    // ["internalid", "anyof", "6458717"]
                ],
                columns: [
                    search.createColumn({
                        name: 'internalid',
                        label: 'Internal ID'
                    }),
                    search.createColumn({
                        name: 'tranid',
                        label: 'Document Number'
                    }),
                    search.createColumn({
                        name: 'entity',
                        label: 'Customer Internal ID'
                    }),
                    search.createColumn({
                        name: 'mainname',
                        label: 'Main Line Name'
                    }),
                    search.createColumn({
                        name: 'trandate',
                        label: 'Date'
                    }),
                    search.createColumn({
                        name: 'statusref',
                        label: 'Status'
                    }),
                    search.createColumn({
                        name: 'custbody_vs_consignment_order',
                        label: 'Consignment Order'
                    }),
                    search.createColumn({
                        name: 'custbody_vs_consignment_inventory_tran',
                        label: 'Consignment Inventory Transfer'
                    }),
                    search.createColumn({
                        name: 'custentityvs_consignment_location',
                        join: 'customer',
                        label: 'Consignment Location'
                    }),
                    search.createColumn({
                        name: 'location',
                        label: 'Warehouse'
                    })
                ]
            });

            log.debug('SEARCH CREATED', 'Consignment Sales Order search created successfully');

            return salesorderSearchObj;

        } catch (e) {
            log.error('GET INPUT DATA ERROR', {
                name: e.name,
                message: e.message,
                stack: e.stack
            });

            throw e;
        }
    }

    function map(context) {
        try {
            log.debug('MAP START', 'Processing search result');

            var result = JSON.parse(context.value);

            var salesOrderId = result.values.internalid.value;
            var customerId = result.values.entity.value;

            log.debug('Sales Order Information', {
                salesOrderId: salesOrderId,
                customerId: customerId
            });

            if (!salesOrderId) {
                log.error('MISSING SALES ORDER ID', 'Sales Order ID was not found');
                return;
            }

            if (!customerId) {
                log.error('MISSING CUSTOMER ID', {
                    salesOrderId: salesOrderId,
                    message: 'Customer ID was not found'
                });
                return;
            }

            /*
             * Load Customer
             */
            log.debug('Loading Customer', {
                customerId: customerId,
                salesOrderId: salesOrderId
            });

            var customerRecord = record.load({
                type: record.Type.CUSTOMER,
                id: customerId,
                isDynamic: false
            });

            var consignmentLocation = customerRecord.getValue({
                fieldId: 'custentityvs_consignment_location'
            });

            log.debug('Customer Consignment Location', {
                customerId: customerId,
                consignmentLocation: consignmentLocation
            });

            if (!consignmentLocation) {
                log.audit('SKIPPED - NO CONSIGNMENT LOCATION', {
                    salesOrderId: salesOrderId,
                    customerId: customerId,
                    message: 'Customer does not have a consignment location'
                });
                return;
            }

            /*
             * Load Sales Order
             */
            log.debug('Loading Sales Order', {
                salesOrderId: salesOrderId
            });

            var salesOrderRecord = record.load({
                type: record.Type.SALES_ORDER,
                id: salesOrderId,
                isDynamic: false
            });

            var currentLocation = salesOrderRecord.getValue({
                fieldId: 'location'
            });

            log.debug('Location Comparison', {
                salesOrderId: salesOrderId,
                currentLocation: currentLocation,
                consignmentLocation: consignmentLocation
            });

            /*
             * Update only when location is different
             */
            if (currentLocation == consignmentLocation) {
                log.audit('SKIPPED - LOCATION ALREADY CORRECT', {
                    salesOrderId: salesOrderId,
                    location: currentLocation
                });
                return;
            }

            salesOrderRecord.setValue({
                fieldId: 'location',
                value: consignmentLocation
            });

            var savedSalesOrderId = salesOrderRecord.save({
                enableSourcing: false,
                ignoreMandatoryFields: false
            });

            log.audit('SALES ORDER LOCATION UPDATED', {
                salesOrderId: savedSalesOrderId,
                customerId: customerId,
                oldLocation: currentLocation,
                newLocation: consignmentLocation
            });

        } catch (e) {
            log.error('MAP ERROR', {
                message: e.message,
                name: e.name,
                stack: e.stack,
                contextValue: context.value
            });

            throw e;
        }
    }

    return {
        getInputData: getInputData,
        map: map
    };
});