/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/search', 'N/log'], function (search, log) {

  function onRequest(context) {
    try {
      if (context.request.method !== 'GET') {
        context.response.write('Use GET.');
        return;
      }

      var jeId = context.request.parameters.jeId || '';
      var jeNumber = context.request.parameters.jeNumber || '';

      if (!jeNumber && jeId) {
        try {
          var lookupTran = search.lookupFields({
            type: 'journalentry',
            id: jeId,
            columns: ['tranid']
          });
          jeNumber = (lookupTran && lookupTran.tranid) ? lookupTran.tranid : '';
        } catch (e) {
          log.error('Lookup tranid failed', e);
        }
      }

      if (!jeNumber) {
        context.response.write('Missing Journal Entry number.');
        return;
      }

      var headerSubsidiaryText = '';
      var headerDateText = '';
      var headerMemoMain = '';

      if (jeId) {
        try {
          var headerLookup = search.lookupFields({
            type: 'journalentry',
            id: jeId,
            columns: ['subsidiary', 'trandate', 'memo']
          });

          if (headerLookup) {
            if (headerLookup.subsidiary && headerLookup.subsidiary.length) {
              headerSubsidiaryText = headerLookup.subsidiary[0].text || '';
            }
            headerDateText = headerLookup.trandate || '';
            headerMemoMain = headerLookup.memo || '';
          }
        } catch (e) {
          log.error('Header lookup failed', e);
        }
      }

      var journalentrySearchObj = search.create({
        type: 'journalentry',
        settings: [{ name: 'consolidationtype', value: 'ACCTTYPE' }],
        filters: [
          ['type', 'anyof', 'Journal'], 'AND',
          ['number', 'equalto', jeNumber]
        ],
        columns: [
          search.createColumn({ name: 'account' }),
          search.createColumn({ name: 'debitamount' }),
          search.createColumn({ name: 'creditamount' }),
          search.createColumn({ name: 'memo' }),
          search.createColumn({ name: 'entity', label: 'Name' }), 
          search.createColumn({ name: 'location' }),
          search.createColumn({ name: 'department' }),
          search.createColumn({ name: 'class' }),
          search.createColumn({ name: 'line.cseg_vs_pro', label: 'Asfar Saud Project' }),
          search.createColumn({ name: 'tranid' }),
          search.createColumn({ name: 'subsidiary' }),
          search.createColumn({ name: 'trandate' }),
          search.createColumn({ name: 'memomain' })
        ]
      });

      function esc(v) {
        var s = (v == null ? '' : String(v));
        if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }

      var rows = [];

      rows.push([
        'Document Number',
        'Subsidiary',
        'Date',
        'Memo (Main)'
      ].join(','));

      rows.push([
        esc(jeNumber),
        esc(headerSubsidiaryText),
        esc(headerDateText),
        esc(headerMemoMain)
      ].join(','));

      rows.push('');

      rows.push([
        'Account',
        'Amount (Debit)',
        'Amount (Credit)',
        'Memo',
        'Name',
        'Location',
        'Department',
        'Class',
        'Asfar Saud Project'
      ].join(','));

      journalentrySearchObj.run().each(function (r) {
        rows.push([
          esc(r.getText({ name: 'account' }) || ''),
          esc(r.getValue({ name: 'debitamount' }) || ''),
          esc(r.getValue({ name: 'creditamount' }) || ''),
          esc(r.getValue({ name: 'memo' }) || ''),
          esc(r.getText({ name: 'entity' }) || ''),
          esc(r.getText({ name: 'location' }) || ''),
          esc(r.getText({ name: 'department' }) || ''),
          esc(r.getText({ name: 'class' }) || ''),
          esc(r.getText({ name: 'line.cseg_vs_pro' }) || '')
        ].join(','));
        return true;
      });

      var contents = '\ufeff' + rows.join('\n');
      var fileName = 'JV - ' + jeNumber + '.csv';

      context.response.setHeader({
        name: 'Content-Type',
        value: 'text/csv; charset=utf-8'
      });
      context.response.setHeader({
        name: 'Content-Disposition',
        value: 'attachment; filename="' + fileName + '"'
      });
      context.response.write(contents);

    } catch (e) {
      try { log.error('Suitelet error', e); } catch (_e) {}
      context.response.write('Error generating CSV: ' + (e && e.message ? e.message : e));
    }
  }

  return { onRequest: onRequest };
});
