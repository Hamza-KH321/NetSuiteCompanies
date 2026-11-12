/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || Contact Request API.js
 */
define(['N/email', 'N/record', 'N/search', 'N/log'], (email, record, search, log) => {

    const CONFIG = {
        AUTHOR_ID: 8, // Naji
        RECIPIENT: 'h.khasawneh@ver-solutions.com',
        SUBSIDIARY_ID: '2', // set if the account is OneWorld, e.g. '1'
        ALLOWED_ORIGIN: '*' // change to https://ver-solutions.com in production
    };

    const COLORS = {
        orangeFrom: '#faaf10',
        orangeTo: '#f17912',
        orangeText: '#d2620a',
        background: '#ffffff',
        text: '#2b2b2b',
        textMuted: '#6b6b6b',
        greyFrom: '#efefef',
        greyTo: '#6c6c6c',
        border: '#e6e6e6' // rgba(43,43,43,0.12) on white
    };

    const LOG_TITLE = 'Contact Request API';

    const onRequest = (context) => {
        const { request, response } = context;

        log.audit(LOG_TITLE + ' | Request received', {
            method: request.method,
            contentType: request.headers ? (request.headers['Content-Type'] || request.headers['content-type']) : '',
            bodyLength: request.body ? request.body.length : 0
        });

        response.setHeader({ name: 'Content-Type', value: 'application/json' });
        response.setHeader({ name: 'Access-Control-Allow-Origin', value: CONFIG.ALLOWED_ORIGIN });
        response.setHeader({ name: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' });
        response.setHeader({ name: 'Access-Control-Allow-Headers', value: 'Content-Type' });

        if (request.method === 'OPTIONS') {
            log.debug(LOG_TITLE + ' | Preflight', 'OPTIONS request answered');
            response.write('');
            return;
        }

        if (request.method !== 'POST') {
            log.error(LOG_TITLE + ' | Method not allowed', request.method);
            respond(response, { success: false, message: 'Only POST is supported.' });
            return;
        }

        try {
            const data = parsePayload(request);
            log.debug(LOG_TITLE + ' | Parsed payload', data);

            const errors = validate(data);

            if (errors.length) {
                log.error(LOG_TITLE + ' | Validation failed', { errors, payload: data });
                respond(response, { success: false, message: 'Validation failed.', errors });
                return;
            }

            let leadResult = { id: null, existing: false };
            let leadError = null;
            try {
                leadResult = createLead(data);
                log.audit(LOG_TITLE + ' | Lead step done', leadResult);
            } catch (e) {
                leadError = e.message;
                log.error(LOG_TITLE + ' | Lead creation failed', { name: e.name, message: e.message, stack: e.stack });
            }

            let emailSent = false;
            let emailError = null;
            try {
                sendNotification(data, leadResult.id);
                emailSent = true;
                log.audit(LOG_TITLE + ' | Email sent', {
                    author: CONFIG.AUTHOR_ID,
                    recipient: CONFIG.RECIPIENT,
                    leadId: leadResult.id
                });
            } catch (e) {
                emailError = e.message;
                log.error(LOG_TITLE + ' | Email sending failed', { name: e.name, message: e.message, stack: e.stack });
            }

            const success = !!leadResult.id || emailSent;
            const result = {
                success,
                leadId: leadResult.id,
                leadAlreadyExisted: leadResult.existing,
                emailSent,
                message: success ? 'Request received.' : 'Request could not be processed.',
                errors: [leadError, emailError].filter(Boolean)
            };

            log.audit(LOG_TITLE + ' | Response', result);
            respond(response, result);
        } catch (e) {
            log.error(LOG_TITLE + ' | Unexpected error', { name: e.name, message: e.message, stack: e.stack });
            respond(response, { success: false, message: 'Unexpected error.', errors: [e.message] });
        }
    };

    const respond = (response, obj) => {
        response.write(JSON.stringify(obj));
    };

    const parsePayload = (request) => {
        let raw = {};
        let source = 'json body';
        try {
            raw = request.body ? JSON.parse(request.body) : {};
        } catch (e) {
            log.debug(LOG_TITLE + ' | Body is not JSON', 'Falling back to request parameters');
            raw = request.parameters || {};
            source = 'parameters';
        }
        if (!raw || typeof raw !== 'object' || !Object.keys(raw).length) {
            raw = request.parameters || {};
            source = 'parameters';
        }
        log.debug(LOG_TITLE + ' | Payload source', source);

        const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
        const subscribe = raw.subscribe;

        return {
            fullName: str(raw.fullName || raw.full_name || raw.name),
            email: str(raw.email || raw.workEmail),
            phone: str(raw.phone),
            company: str(raw.company),
            interest: str(raw.interest || raw.interestedIn),
            message: str(raw.message),
            subscribe: subscribe === true || subscribe === 'true' || subscribe === 'T' || subscribe === 'on' || subscribe === '1'
        };
    };

    const validate = (d) => {
        const errors = [];
        if (!d.fullName) errors.push('fullName is required.');
        if (!d.email) {
            errors.push('email is required.');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
            errors.push('email is not valid.');
        }
        return errors;
    };

    const splitName = (fullName) => {
        const parts = fullName.split(/\s+/);
        const firstName = parts.shift() || fullName;
        const lastName = parts.join(' ') || '-';
        return { firstName, lastName };
    };

    const findExistingByEmail = (emailAddress) => {
        let id = null;
        search.create({
            type: search.Type.CUSTOMER,
            filters: [['email', 'is', emailAddress]],
            columns: ['internalid']
        }).run().each((r) => {
            id = r.id;
            return false;
        });
        log.debug(LOG_TITLE + ' | Existing customer search', { email: emailAddress, foundId: id });
        return id;
    };

    const createLead = (d) => {
        const existingId = findExistingByEmail(d.email);
        if (existingId) {
            log.audit(LOG_TITLE + ' | Lead skipped', 'Customer already exists with ID ' + existingId + ' for ' + d.email);
            return { id: existingId, existing: true };
        }

        const { firstName, lastName } = splitName(d.fullName);
        const lead = record.create({ type: record.Type.LEAD, isDynamic: true });

        if (CONFIG.SUBSIDIARY_ID) {
            lead.setValue({ fieldId: 'subsidiary', value: CONFIG.SUBSIDIARY_ID });
        }

        if (d.company) {
            lead.setValue({ fieldId: 'isperson', value: 'F' });
            lead.setValue({ fieldId: 'companyname', value: d.company });
        } else {
            lead.setValue({ fieldId: 'isperson', value: 'T' });
            lead.setValue({ fieldId: 'firstname', value: firstName });
            lead.setValue({ fieldId: 'lastname', value: lastName });
        }

        lead.setValue({ fieldId: 'email', value: d.email });
        if (d.phone) lead.setValue({ fieldId: 'phone', value: d.phone });

        const comments = [
            'Contact: ' + d.fullName,
            d.interest ? 'Interested in: ' + d.interest : '',
            d.message ? 'Message: ' + d.message : '',
            'Subscribed to updates: ' + (d.subscribe ? 'Yes' : 'No'),
            'Source: Website contact form'
        ].filter(Boolean).join('\n');
        lead.setValue({ fieldId: 'comments', value: comments });

        const leadId = lead.save({ enableSourcing: true, ignoreMandatoryFields: false });
        log.audit(LOG_TITLE + ' | Lead created', { leadId, type: d.company ? 'company' : 'individual', email: d.email });

        if (d.company) {
            try {
                const contact = record.create({ type: record.Type.CONTACT, isDynamic: true });
                contact.setValue({ fieldId: 'firstname', value: firstName });
                contact.setValue({ fieldId: 'lastname', value: lastName });
                contact.setValue({ fieldId: 'email', value: d.email });
                if (d.phone) contact.setValue({ fieldId: 'phone', value: d.phone });
                contact.setValue({ fieldId: 'company', value: leadId });
                if (CONFIG.SUBSIDIARY_ID) contact.setValue({ fieldId: 'subsidiary', value: CONFIG.SUBSIDIARY_ID });
                const contactId = contact.save();
                log.audit(LOG_TITLE + ' | Contact created', { contactId, leadId });
            } catch (e) {
                log.error(LOG_TITLE + ' | Contact creation failed for lead ' + leadId, { name: e.name, message: e.message });
            }
        }

        return { id: leadId, existing: false };
    };

    const esc = (v) => String(v === undefined || v === null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br/>');

    const row = (label, value) => `
        <tr>
            <td style="padding:12px 0;border-bottom:1px solid ${COLORS.border};width:140px;vertical-align:top;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.6px;color:${COLORS.orangeText};">${label}</td>
            <td style="padding:12px 0;border-bottom:1px solid ${COLORS.border};vertical-align:top;font-size:15px;color:${COLORS.text};">${value}</td>
        </tr>`;

    const buildEmailBody = (d, leadId) => {
        const emailLink = `<a href="mailto:${esc(d.email)}" style="color:${COLORS.orangeText};text-decoration:none;">${esc(d.email)}</a>`;
        const phoneValue = d.phone ? `<a href="tel:${esc(d.phone)}" style="color:${COLORS.orangeText};text-decoration:none;">${esc(d.phone)}</a>` : '-';

        return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:${COLORS.greyFrom};font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.greyFrom};padding:32px 12px;">
<tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${COLORS.background};border:1px solid ${COLORS.border};border-radius:20px;overflow:hidden;">

        <tr>
            <td style="background-color:${COLORS.orangeTo};background-image:linear-gradient(135deg,${COLORS.orangeFrom},${COLORS.orangeTo});padding:28px 32px;">
                <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;opacity:0.9;">VER Solutions</div>
                <div style="font-size:24px;font-weight:bold;color:#ffffff;margin-top:6px;">New website request</div>
            </td>
        </tr>

        <tr>
            <td style="padding:28px 32px 8px 32px;">
                <p style="margin:0 0 4px 0;font-size:16px;color:${COLORS.text};"><strong>${esc(d.fullName)}</strong> just sent a request through the website.</p>
                <p style="margin:0;font-size:14px;color:${COLORS.textMuted};">A lead has been ${leadId ? 'recorded in NetSuite (ID ' + esc(leadId) + ')' : 'attempted but not created, please check the script log'}.</p>
            </td>
        </tr>

        <tr>
            <td style="padding:8px 32px 8px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${COLORS.border};">
                    ${row('Full name', esc(d.fullName))}
                    ${row('Work email', emailLink)}
                    ${row('Phone', phoneValue)}
                    ${row('Company', d.company ? esc(d.company) : '-')}
                    ${row('Interested in', d.interest ? esc(d.interest) : '-')}
                    ${row('Updates', d.subscribe ? 'Yes, send updates and insights' : 'No')}
                </table>
            </td>
        </tr>

        <tr>
            <td style="padding:16px 32px 8px 32px;">
                <div style="font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.6px;color:${COLORS.orangeText};margin-bottom:8px;">How can we help?</div>
                <div style="border:1px solid ${COLORS.border};border-radius:14px;padding:16px 18px;font-size:15px;line-height:1.6;color:${COLORS.text};">${d.message ? esc(d.message) : '<span style="color:' + COLORS.textMuted + ';">No message provided.</span>'}</div>
            </td>
        </tr>

        <tr>
            <td style="padding:24px 32px 32px 32px;" align="left">
                <a href="mailto:${esc(d.email)}" style="display:inline-block;background-color:${COLORS.orangeTo};background-image:linear-gradient(135deg,${COLORS.orangeFrom},${COLORS.orangeTo});color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 28px;border-radius:999px;">Reply to ${esc(d.fullName.split(/\s+/)[0])}</a>
            </td>
        </tr>

        <tr>
            <td style="background-color:${COLORS.greyFrom};background-image:linear-gradient(90deg,${COLORS.greyFrom},#dcdcdc);padding:16px 32px;font-size:12px;color:${COLORS.textMuted};">
                Sent automatically from the VER Solutions website contact form.
            </td>
        </tr>
    </table>
</td></tr>
</table>
</body>
</html>`;
    };

    const sendNotification = (d, leadId) => {
        const options = {
            author: CONFIG.AUTHOR_ID,
            recipients: [CONFIG.RECIPIENT],
            replyTo: d.email,
            subject: 'New website request: ' + d.fullName + (d.company ? ' (' + d.company + ')' : ''),
            body: buildEmailBody(d, leadId)
        };
        if (leadId) {
            options.relatedRecords = { entityId: Number(leadId) };
        }
        log.debug(LOG_TITLE + ' | Sending email', { author: options.author, recipients: options.recipients, subject: options.subject, relatedRecords: options.relatedRecords });
        email.send(options);
    };

    return { onRequest };
});