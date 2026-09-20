/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Customer Deposit Reversal
 */

define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function onRequest(scriptContext) {

        var request = scriptContext.request;
        var response = scriptContext.response;

        try {

            log.debug({
                title: 'Deposit Reversal API - Start',
                details: 'Request Method: ' + request.method
            });

            if (request.method != 'POST') {

                response.setHeader({
                    name: 'Content-Type',
                    value: 'application/json'
                });

                response.write(JSON.stringify({
                    success: false,
                    message: 'Only POST method is allowed.'
                }));

                return;
            }

            var body = request.body;

            log.debug({
                title: 'Deposit Reversal API - Request Body',
                details: body
            });

            if (!body) {

                response.setHeader({
                    name: 'Content-Type',
                    value: 'application/json'
                });

                response.write(JSON.stringify({
                    success: false,
                    message: 'Request body is required.'
                }));

                return;
            }

            var requestData;

            try {
                requestData = JSON.parse(body);
            } catch (jsonError) {

                log.error({
                    title: 'Invalid JSON',
                    details: jsonError
                });

                response.setHeader({
                    name: 'Content-Type',
                    value: 'application/json'
                });

                response.write(JSON.stringify({
                    success: false,
                    message: 'Invalid JSON request body.'
                }));

                return;
            }

            var customerInternalId = requestData.customerInternalId;
            var memo = requestData.memo;
            var amount = requestData.amount;

            log.debug({
                title: 'Parsed Request',
                details: {
                    customerInternalId: customerInternalId,
                    memo: memo,
                    amount: amount
                }
            });

            /*
             * Validate Customer Internal ID
             */
            if (!customerInternalId) {

                response.setHeader({
                    name: 'Content-Type',
                    value: 'application/json'
                });

                response.write(JSON.stringify({
                    success: false,
                    message: 'customerInternalId is required.'
                }));

                return;
            }

            /*
             * Validate Amount
             */
            if (amount == null || amount == '' || isNaN(amount)) {

                response.setHeader({
                    name: 'Content-Type',
                    value: 'application/json'
                });

                response.write(JSON.stringify({
                    success: false,
                    message: 'amount is required and must be a valid number.'
                }));

                return;
            }

            amount = parseFloat(amount);

            if (amount <= 0) {

                response.setHeader({
                    name: 'Content-Type',
                    value: 'application/json'
                });

                response.write(JSON.stringify({
                    success: false,
                    message: 'amount must be greater than zero.'
                }));

                return;
            }

            /*
             * Load Customer
             */
            var customerRecord;

            try {

                customerRecord = record.load({
                    type: record.Type.CUSTOMER,
                    id: customerInternalId
                });

            } catch (customerError) {

                log.error({
                    title: 'Customer Load Error',
                    details: customerError
                });

                response.setHeader({
                    name: 'Content-Type',
                    value: 'application/json'
                });

                response.write(JSON.stringify({
                    success: false,
                    message: 'Customer was not found.',
                    customerInternalId: customerInternalId
                }));

                return;
            }

            /*
             * Get Customer AR Account
             */
            var customerAccountId = customerRecord.getValue({
                fieldId: 'receivablesaccount'
            });

            log.debug({
                title: 'Customer AR Account',
                details: customerAccountId
            });

            if (!customerAccountId) {

                response.setHeader({
                    name: 'Content-Type',
                    value: 'application/json'
                });

                response.write(JSON.stringify({
                    success: false,
                    message: 'The customer does not have a Receivables Account.'
                }));

                return;
            }

            log.debug({
                title: 'Customer AR Account Found',
                details: {
                    customerInternalId: customerInternalId,
                    customerAccountId: customerAccountId
                }
            });

            log.debug({
                title: 'Customer Account Found',
                details: {
                    accountNumber: customerAccountId,
                    accountInternalId: customerAccountId
                }
            });

            /*
             * Customer Deposits Account
             * Internal ID: 979
             */
            var customerDepositsAccountId = 979;

            log.debug({
                title: 'Customer Deposits Account',
                details: {
                    accountInternalId: customerDepositsAccountId,
                    accountName: 'Customer Deposits'
                }
            });

            /*
             * Create Journal Entry
             */
            var journalEntry = record.create({
                type: record.Type.JOURNAL_ENTRY,
                isDynamic: true
            });

            journalEntry.setValue({
                fieldId: 'customform',
                value: 163
            });

            journalEntry.setValue({
                fieldId: 'subsidiary',
                value: 2
            });

            journalEntry.setValue({
                fieldId: 'custbody_vs_shoof_transaction',
                value: true
            });

            /*
             * Set Memo
             */
            if (memo) {

                journalEntry.setValue({
                    fieldId: 'memo',
                    value: memo
                });

            }

            /*
             * Debit Customer Deposits - Account 979
             */
            journalEntry.selectNewLine({
                sublistId: 'line'
            });

            journalEntry.setCurrentSublistValue({
                sublistId: 'line',
                fieldId: 'account',
                value: customerDepositsAccountId
            });

            journalEntry.setCurrentSublistValue({
                sublistId: 'line',
                fieldId: 'debit',
                value: amount
            });

            if (customerInternalId) {

                journalEntry.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'entity',
                    value: customerInternalId
                });

            }

            journalEntry.commitLine({
                sublistId: 'line'
            });

            /*
             * Credit Customer Account
             */
            journalEntry.selectNewLine({
                sublistId: 'line'
            });

            journalEntry.setCurrentSublistValue({
                sublistId: 'line',
                fieldId: 'account',
                value: customerAccountId
            });

            journalEntry.setCurrentSublistValue({
                sublistId: 'line',
                fieldId: 'credit',
                value: amount
            });

            if (customerInternalId) {

                journalEntry.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'entity',
                    value: customerInternalId
                });

            }

            journalEntry.commitLine({
                sublistId: 'line'
            });

            log.debug({
                title: 'Journal Entry Before Save',
                details: {
                    customerInternalId: customerInternalId,
                    customerAccountId: customerAccountId,
                    customerDepositsAccountId: customerDepositsAccountId,
                    amount: amount,
                    memo: memo
                }
            });

            /*
             * Save Journal Entry
             */
            var journalEntryId = journalEntry.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            log.audit({
                title: 'Deposit Reversal Journal Entry Created',
                details: {
                    journalEntryId: journalEntryId,
                    customerInternalId: customerInternalId,
                    amount: amount
                }
            });

            /*
             * Response
             */
            response.setHeader({
                name: 'Content-Type',
                value: 'application/json'
            });

            response.write(JSON.stringify({
                success: true,
                message: 'Deposit reversal journal entry created successfully.',
                journalEntryInternalId: journalEntryId,
                customerInternalId: customerInternalId,
                customerDepositsAccount: '979',
                amount: amount,
                memo: memo || ''
            }));

        } catch (error) {

            log.error({
                title: 'Deposit Reversal API - Unexpected Error',
                details: error
            });

            response.setHeader({
                name: 'Content-Type',
                value: 'application/json'
            });

            response.write(JSON.stringify({
                success: false,
                message: 'Unexpected error occurred while creating the deposit reversal.',
                error: error.message || error
            }));
        }
    }

    return {
        onRequest: onRequest
    };

});