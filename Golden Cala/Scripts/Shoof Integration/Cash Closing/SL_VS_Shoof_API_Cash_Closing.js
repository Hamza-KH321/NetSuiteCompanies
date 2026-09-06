/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Shoof API Cash Closing
 */
define(['N/record', 'N/log'], function (record, log) {

    // Currency ISO → Internal ID mapping
    var CURRENCY_ISO_TO_ID = {
        'SAR': 1,
        'USD': 2,
        'CAD': 3,
        'EUR': 4,
        'GBP': 5,
        'AED': 6,
        'KWD': 7
    };

    // Updated allowed types
    var ALLOWED_TYPES = [
        'Cash Closing',
        'Credit Closing',
        'Deposit'
    ];

    // Account mapping with internal IDs (and account numbers in comments)
    var ACCOUNT_MAP = {
        'Cash Closing': {
            debit: 1293,
            credit: 1290,
            variance: 1292
        },

        'Credit Closing': {
            debit: 1293,
            credit: 1291,
            variance: 1292
        },

        'Deposit': {
            debit: 1246,
            credit: 1293
        }
    };

    function onRequest(context) {
        if (context.request.method !== 'POST') {
            return sendJson(context, 405, {
                success: false,
                code: 'METHOD_NOT_ALLOWED',
                message: 'Use POST with JSON body.'
            });
        }

        var bodyStr = context.request.body || '{}';
        var body;
        try {
            body = JSON.parse(bodyStr);
        } catch (e) {
            log.error('INVALID_JSON', e);
            return sendJson(context, 400, {
                success: false,
                code: 'INVALID_JSON',
                message: 'Request body must be valid JSON.'
            });
        }

        log.audit('Shoof Cash Closing API - Incoming', body);

        var errors = [];

        // Date validation
        var dateText = (body.date || '').toString().trim();
        if (!dateText) {
            errors.push('date is required (format dd/mm/yyyy).');
        } else if (!isValidDDMMYYYY(dateText)) {
            errors.push('date must be in dd/mm/yyyy format.');
        }

        // Amount validation
        var amount = Number(body.amount);
        if (!isFinite(amount) || amount <= 0) {
            errors.push('amount is required and must be a number greater than 0.');
        }

        // Variance validation
        var variance = Number(body.variance || 0);
        if (!isFinite(variance)) {
            errors.push('variance must be a valid number.');
        }

        // Currency validation
        var currencyIso = (body.currency || '').toString().trim().toUpperCase();
        if (!currencyIso) {
            errors.push('currency is required (ISO code, e.g., SAR, USD).');
        } else if (!CURRENCY_ISO_TO_ID[currencyIso]) {
            errors.push('currency "' + currencyIso + '" is not configured. Valid: ' + Object.keys(CURRENCY_ISO_TO_ID).join(', ') + '.');
        }

        // Type validation
        var typeInput = (body.type || '').toString().trim();
        if (!typeInput) {
            errors.push('type is required.');
        } else if (!isAllowedType(typeInput)) {
            errors.push('type must be one of: ' + ALLOWED_TYPES.join(', ') + '.');
        }

        if (errors.length) {
            return sendJson(context, 400, { success: false, code: 'VALIDATION_ERROR', message: errors.join(' ') });
        }

        var normalizedType = normalizeType(typeInput);

        try {
            var accounts = ACCOUNT_MAP[normalizedType];
            if (!accounts) {
                return sendJson(context, 400, {
                    success: false,
                    code: 'UNSUPPORTED_TYPE',
                    message: 'Type "' + normalizedType + '" is not supported.'
                });
            }

            // Special validation for Deposit
            if (normalizedType == 'Deposit' && variance != 0) {
                return sendJson(context, 400, {
                    success: false,
                    code: 'INVALID_VARIANCE',
                    message: 'Variance must be 0 for Deposit transactions.'
                });
            }

            // Create Journal Entry
            var journalEntry = record.create({ type: record.Type.JOURNAL_ENTRY, isDynamic: true });
            journalEntry.setValue({ fieldId: 'customform', value: 163 });
            journalEntry.setValue({ fieldId: 'subsidiary', value: 3 });
            journalEntry.setValue({ fieldId: 'custbody_vs_shoof_transaction', value: true });

            if (body.trxNum !== undefined && body.trxNum !== null && body.trxNum !== '') {
                journalEntry.setValue({ fieldId: 'custbody_vs_shoof_transaction_id', value: body.trxNum });
            }

            if (body.memo) {
                journalEntry.setValue({ fieldId: 'memo', value: String(body.memo) });
            }

            journalEntry.setValue({ fieldId: 'currency', value: CURRENCY_ISO_TO_ID[currencyIso] });
            journalEntry.setText({ fieldId: 'trandate', text: dateText });

            // Debit line
            var debitAmount = amount;
            var creditAmount = amount;

            if (normalizedType != 'Deposit' && variance > 0) {
                debitAmount = amount - variance;
            }

            if (normalizedType != 'Deposit' && variance < 0) {
                creditAmount = amount - Math.abs(variance);
            }

            var debitAccount = accounts.debit;
            var creditAccount = accounts.credit;

            if (variance < 0) {
                debitAccount = accounts.credit;
                creditAccount = accounts.debit;
            }

            journalEntry.selectNewLine({ sublistId: 'line' });
            journalEntry.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: debitAccount });
            journalEntry.setCurrentSublistValue({ sublistId: 'line', fieldId: 'debit', value: round2(debitAmount) });
            journalEntry.commitLine({ sublistId: 'line' });

            // Credit line
            journalEntry.selectNewLine({ sublistId: 'line' });
            journalEntry.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: creditAccount });
            journalEntry.setCurrentSublistValue({ sublistId: 'line', fieldId: 'credit', value: round2(creditAmount) });
            journalEntry.commitLine({ sublistId: 'line' });

            // Shortage line (if applicable)
            if (normalizedType != 'Deposit' && variance != 0) {

                journalEntry.selectNewLine({ sublistId: 'line' });
                journalEntry.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'account',
                    value: accounts.variance
                });

                if (variance > 0) {
                    journalEntry.setCurrentSublistValue({
                        sublistId: 'line',
                        fieldId: 'debit',
                        value: round2(variance)
                    });
                } else {
                    journalEntry.setCurrentSublistValue({
                        sublistId: 'line',
                        fieldId: 'credit',
                        value: round2(Math.abs(variance))
                    });
                }

                journalEntry.commitLine({ sublistId: 'line' });
            }

            var journalEntryId = journalEntry.save();

            log.audit('Journal Entry Created', {
                id: journalEntryId,
                type: normalizedType,
                amount: amount,
                variance: variance,
                currency: currencyIso,
                date: dateText
            });

            return sendJson(context, 200, {
                success: true,
                id: journalEntryId,
                message: 'Journal Entry created successfully.'
            });

        } catch (e) {
            log.error('JOURNAL_ENTRY_CREATE_ERROR', e);
            return sendJson(context, 500, {
                success: false,
                code: 'JOURNAL_ENTRY_CREATE_ERROR',
                message: e && e.message ? e.message : 'Unexpected error while creating Journal Entry.'
            });
        }
    }

    function sendJson(context, status, obj) {
        context.response.addHeader({ name: 'Content-Type', value: 'application/json' });
        context.response.status = status;
        context.response.write(JSON.stringify(obj));
    }

    function isAllowedType(typeStr) {
        var norm = normalizeType(typeStr);
        for (var i = 0; i < ALLOWED_TYPES.length; i++) {
            if (normalizeType(ALLOWED_TYPES[i]) === norm) return true;
        }
        return false;
    }

    function normalizeType(typeStr) {
        return String(typeStr || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
            .replace(/\b\w/g, function (m) { return m.toUpperCase(); });
    }

    function isValidDDMMYYYY(text) {
        var rx = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
        return rx.test(text);
    }

    function round2(n) {
        return Math.round(Number(n) * 100) / 100;
    }

    return {
        onRequest: onRequest
    };
});
