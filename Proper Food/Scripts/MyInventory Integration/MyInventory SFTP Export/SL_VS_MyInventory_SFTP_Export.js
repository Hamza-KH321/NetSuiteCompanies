/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @fileName SL || MyInventory SFTP Export
 */
define(['N/ui/serverWidget', 'N/sftp', 'N/runtime', 'N/url', 'N/record', 'N/log'],
    (serverWidget, sftp, runtime, url, record, log) => {

        const CONFIG = {
            PARAM_SFTP_CONFIG: 'custscript_vs_myinv_sftp_config',
            CONFIG_RECORD: 'customrecord_vs_myinv_sftp_configuration',
            FILE_REGEX: /^PFR(\d{4})(\d{2})(\d{2})_(\d+)\.csv$/i
        };

        const CLIENT_HTML = String.raw`
<style>
.myi{font-family:"Open Sans",Arial,sans-serif;font-size:13px;color:#2b2b2b;max-width:1150px;margin:8px 0}
.myi .row{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:14px}
.myi label{font-weight:600}
.myi input[type=date]{padding:5px 8px;border:1px solid #b8c2cc;border-radius:4px;font-size:13px}
.myi button{padding:7px 18px;border:0;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer}
.myi button.pri{background:#125ab2;color:#fff}
.myi button.ok{background:#1e8e3e;color:#fff}
.myi button:disabled{background:#c9d0d6;color:#fff;cursor:not-allowed}
.myi .bar{position:relative;height:26px;background:#e6ebef;border-radius:13px;overflow:hidden}
.myi .fill{height:100%;width:0;background:linear-gradient(90deg,#125ab2,#3d8bea);transition:width .35s ease}
.myi .bar.busy .fill{width:35%!important;animation:myislide 1.1s infinite ease-in-out}
@keyframes myislide{0%{margin-left:-35%}100%{margin-left:100%}}
.myi .pct{position:absolute;left:0;right:0;top:0;line-height:26px;text-align:center;font-weight:700;color:#1b2a3a;text-shadow:0 0 3px #fff}
.myi .meta{display:flex;justify-content:space-between;margin:8px 2px 14px;color:#4b5a68}
.myi .err{color:#c62828;font-weight:600}
.myi table{border-collapse:collapse;width:100%}
.myi th{background:#f1f4f7;text-align:left;padding:6px 8px;border-bottom:2px solid #d5dce2}
.myi td{padding:5px 8px;border-bottom:1px solid #e6ebef}
.myi .st-ok{color:#1e8e3e;font-weight:600}.myi .st-error{color:#c62828;font-weight:600}.myi .st-loading{color:#125ab2;font-weight:600}.myi .st-pending{color:#8a96a1}
.myi .tw{max-height:380px;overflow:auto;border:1px solid #e1e6ea;border-radius:4px;margin-top:10px}
.myi .sum{margin-top:10px;font-weight:600}
.myi .setup{margin-top:16px;font-size:12px}
</style>
<div class="myi">
  <div class="row">
    <label for="myi_from">Date From</label><input type="date" id="myi_from">
    <label for="myi_to">Date To</label><input type="date" id="myi_to">
    <button class="pri" id="myi_go" type="button">Fetch Files</button>
    <button class="ok" id="myi_dl" type="button" disabled>Download Excel</button>
    <label><input type="checkbox" id="myi_auto" checked> Auto refresh every 5 seconds</label>
  </div>
  <div class="bar" id="myi_bar"><div class="fill" id="myi_fill"></div><div class="pct" id="myi_pct">0%</div></div>
  <div class="meta"><span id="myi_status">Select a date range and click Fetch Files.</span><span id="myi_next"></span></div>
  <div class="sum" id="myi_sum"></div>
  <div class="tw"><table><thead><tr><th>File</th><th>File Date</th><th>Size (bytes)</th><th>Status</th><th>Rows</th></tr></thead><tbody id="myi_tbody"></tbody></table></div>
</div>
<script>
(function () {
  var BASE = '__URL__';
  var HEADERS = ['Company Code/Client','Booking Number','Period','Posting Date','Invoice Date','Invoice Due Date','Invoice Number','Interface Transaction Number','Document Number','Accoun Type','Account Codes','Contra Account Type','Contra Account','Debit/Credit Marker','Amount','VAT','VAT Rate','Tax Key','Description','','','Cost Center Number',''];
  var NCOLS = 23;
  var DATE_COLS = {3:1, 4:1, 5:1, 22:1};
  var TEXT_COLS = {18:1};
  var PERIOD_COL = 2;
  var COL_WIDTHS = {0:12.71, 3:10.29, 7:10.43, 9:10.29, 18:43.57, 22:10.29};
  var S = {files:{}, list:[], from:'', to:'', busy:false, active:false, timer:null, left:5, total:0};

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function nowText() { var d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); }

  /* ---------- CSV parsing ---------- */
  function dateSerial(y, m, d) { return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000); }

  function convert(i, v) {
    if (v === '') { return null; }
    if (DATE_COLS[i]) {
      var m = /^(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})$/.exec(v);
      return m ? {d: dateSerial(+m[1], +m[2], +m[3])} : v;
    }
    if (TEXT_COLS[i]) { return v; }
    if (/^-?\d*\.?\d+$/.test(v)) { return Number(v); }
    return v;
  }

  function parseCsv(text) {
    var out = [];
    String(text).replace(/^﻿/, '').split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) { return; }
      var f = line.split(';'), row = [];
      for (var i = 0; i < NCOLS; i++) { row.push(convert(i, (f[i] || '').trim())); }
      out.push(row);
    });
    return out;
  }

  /* ---------- XLSX writer (no external library) ---------- */
  var CRC_TABLE = (function () {
    var t = [], c, n, k;
    for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); } t[n] = c >>> 0; }
    return t;
  })();

  function crc32(buf) {
    var crc = -1;
    for (var i = 0; i < buf.length; i++) { crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8); }
    return (crc ^ -1) >>> 0;
  }

  function buildZip(files) {
    var enc = new TextEncoder(), chunks = [], central = [], offset = 0, cdSize = 0;
    files.forEach(function (f) {
      var nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      var lh = new Uint8Array(30 + nm.length), dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true);
      dv.setUint16(8, 0, true); dv.setUint16(10, 0, true); dv.setUint16(12, 0x21, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, sz, true); dv.setUint32(22, sz, true);
      dv.setUint16(26, nm.length, true); dv.setUint16(28, 0, true); lh.set(nm, 30);
      chunks.push(lh, f.data);
      var ch = new Uint8Array(46 + nm.length), cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, sz, true); cv.setUint32(24, sz, true);
      cv.setUint16(28, nm.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, offset, true);
      ch.set(nm, 46);
      central.push(ch); cdSize += ch.length; offset += lh.length + sz;
    });
    var end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);
    return chunks.concat(central, [end]);
  }

  function xmlText(s) {
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function cellXml(ref, v, colIdx, header) {
    if (header) { return v === '' ? '' : '<c r="' + ref + '" s="1" t="inlineStr"><is><t xml:space="preserve">' + xmlText(v) + '</t></is></c>'; }
    if (v === null || v === undefined) { return ''; }
    if (typeof v === 'number') { return '<c r="' + ref + '" s="' + (colIdx === PERIOD_COL ? 3 : 0) + '"><v>' + v + '</v></c>'; }
    if (typeof v === 'object') { return '<c r="' + ref + '" s="2"><v>' + v.d + '</v></c>'; }
    return '<c r="' + ref + '" s="0" t="inlineStr"><is><t xml:space="preserve">' + xmlText(v) + '</t></is></c>';
  }

  function sheetXml(rows) {
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>';
    for (var k in COL_WIDTHS) { x += '<col min="' + (+k + 1) + '" max="' + (+k + 1) + '" width="' + COL_WIDTHS[k] + '" customWidth="1"/>'; }
    x += '</cols><sheetData><row r="1">';
    HEADERS.forEach(function (h, i) { x += cellXml(String.fromCharCode(65 + i) + '1', h, i, true); });
    x += '</row>';
    rows.forEach(function (row, r) {
      x += '<row r="' + (r + 2) + '">';
      for (var i = 0; i < NCOLS; i++) { x += cellXml(String.fromCharCode(65 + i) + (r + 2), row[i], i, false); }
      x += '</row>';
    });
    return x + '</sheetData></worksheet>';
  }

  function buildXlsxParts(rows) {
    var enc = new TextEncoder(), H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    var parts = [
      {name: '[Content_Types].xml', text: H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
      {name: '_rels/.rels', text: H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
      {name: 'xl/workbook.xml', text: H + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Headers" sheetId="1" r:id="rId1"/></sheets></workbook>'},
      {name: 'xl/_rels/workbook.xml.rels', text: H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
      {name: 'xl/styles.xml', text: H + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="9"/><name val="Arial"/></font><font><b/><sz val="9"/><name val="Aptos Narrow"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'},
      {name: 'xl/worksheets/sheet1.xml', text: sheetXml(rows)}
    ];
    return parts.map(function (p) { return {name: p.name, data: enc.encode(p.text)}; });
  }

  function buildXlsxBlob(rows) {
    return new Blob(buildZip(buildXlsxParts(rows)), {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }

  /* ---------- server calls ---------- */
  function api(params) {
    var qs = [];
    for (var k in params) { qs.push(k + '=' + encodeURIComponent(params[k])); }
    return fetch(BASE + '&' + qs.join('&'), {credentials: 'same-origin'})
      .then(function (r) { return r.text(); })
      .then(function (t) {
        try { return JSON.parse(t); } catch (e) { throw new Error('Unexpected response from the server (session may have expired).'); }
      });
  }

  /* ---------- UI helpers ---------- */
  function setStatus(msg, isErr) { var e = $('myi_status'); e.className = isErr ? 'err' : ''; e.textContent = msg; }

  function counts() {
    var done = 0, rows = 0, err = 0;
    S.list.forEach(function (f) {
      var c = S.files[f.name];
      if (c && c.status === 'ok') { done++; rows += c.rows.length; }
      if (c && c.status === 'error') { err++; }
    });
    return {done: done, rows: rows, err: err};
  }

  function updateBar() {
    var c = counts(), total = S.list.length, pct = total ? Math.round(c.done / total * 100) : 0;
    $('myi_fill').style.width = pct + '%';
    $('myi_pct').textContent = total ? (c.done + ' / ' + total + ' files (' + pct + '%)') : '0%';
    $('myi_sum').textContent = total ? ('Files: ' + total + '   |   Loaded: ' + c.done + '   |   Failed: ' + c.err + '   |   Rows: ' + c.rows) : '';
    $('myi_dl').disabled = c.rows === 0;
  }

  function renderTable() {
    var h = '';
    S.list.forEach(function (f) {
      var c = S.files[f.name] || {status: 'pending', rows: []};
      h += '<tr><td>' + esc(f.name) + '</td><td>' + esc(f.date) + '</td><td>' + esc(f.size) + '</td><td class="st-' + c.status + '">' +
        esc(c.status === 'error' ? ('error: ' + (c.msg || '')) : c.status) + '</td><td>' + (c.status === 'ok' ? c.rows.length : '') + '</td></tr>';
    });
    $('myi_tbody').innerHTML = h;
  }

  function setBusyBar(on) { $('myi_bar').className = on ? 'bar busy' : 'bar'; }

  /* ---------- fetch / refresh cycle ---------- */
  function stopTimer() { if (S.timer) { clearInterval(S.timer); S.timer = null; } $('myi_next').textContent = ''; }

  function scheduleRefresh() {
    stopTimer();
    if (!$('myi_auto').checked || !S.active) { return; }
    S.left = 5;
    $('myi_next').textContent = 'Next refresh in ' + S.left + 's';
    S.timer = setInterval(function () {
      S.left--;
      if (S.left <= 0) { stopTimer(); run(true); } else { $('myi_next').textContent = 'Next refresh in ' + S.left + 's'; }
    }, 1000);
  }

  function loadFile(f) {
    S.files[f.name] = {status: 'loading', size: f.size, rows: []};
    renderTable();
    return api({action: 'file', name: f.name}).then(function (res) {
      if (!res.success) { throw new Error(res.message); }
      S.files[f.name] = {status: 'ok', size: f.size, rows: parseCsv(res.content)};
    }).catch(function (e) {
      S.files[f.name] = {status: 'error', size: f.size, rows: [], msg: e.message};
    }).then(function () { updateBar(); renderTable(); });
  }

  function run(isRefresh) {
    if (S.busy) { return; }
    S.busy = true;
    stopTimer();
    setStatus(isRefresh ? 'Checking SFTP for new files...' : 'Connecting to SFTP...');
    if (!isRefresh) { setBusyBar(true); }
    api({action: 'list', from: S.from, to: S.to}).then(function (res) {
      if (!res.success) { throw new Error(res.message); }
      setBusyBar(false);
      S.list = res.files;
      var pending = res.files.filter(function (f) {
        var c = S.files[f.name];
        return !c || c.status !== 'ok' || c.size !== f.size;
      });
      pending.forEach(function (f) { if (!S.files[f.name]) { S.files[f.name] = {status: 'pending', size: f.size, rows: []}; } });
      updateBar(); renderTable();
      if (pending.length) { setStatus('Downloading ' + pending.length + ' file(s) from SFTP...'); }
      return pending.reduce(function (p, f) { return p.then(function () { return loadFile(f); }); }, Promise.resolve());
    }).then(function () {
      var c = counts();
      if (!S.list.length) { setStatus('No files found in this date range. Still watching...'); }
      else if (c.err) { setStatus('Finished with ' + c.err + ' failed file(s) - they will be retried. Last check ' + nowText(), true); }
      else { setStatus('Up to date. Last check ' + nowText()); }
    }).catch(function (e) {
      setBusyBar(false);
      setStatus('Error: ' + e.message + '  (retrying)', true);
    }).then(function () {
      S.busy = false;
      scheduleRefresh();
    });
  }

  function start() {
    var from = $('myi_from').value, to = $('myi_to').value;
    if (!from || !to) { setStatus('Please select both Date From and Date To.', true); return; }
    if (from > to) { setStatus('Date From cannot be after Date To.', true); return; }
    if (S.busy) { setStatus('Please wait for the current run to finish.', true); return; }
    S.from = from; S.to = to; S.files = {}; S.list = []; S.active = true;
    updateBar(); renderTable();
    run(false);
  }

  function download() {
    var rows = [];
    S.list.forEach(function (f) {
      var c = S.files[f.name];
      if (c && c.status === 'ok') { rows = rows.concat(c.rows); }
    });
    if (!rows.length) { setStatus('There is no data to download yet.', true); return; }
    var blob = buildXlsxBlob(rows);
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'PFR_' + S.from.replace(/-/g, '') + '_' + S.to.replace(/-/g, '') + '.xlsx';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 1000);
  }

  function init() {
    $('myi_go').addEventListener('click', start);
    $('myi_dl').addEventListener('click', download);
    $('myi_auto').addEventListener('change', function () {
      if (this.checked) { if (S.active && !S.busy) { scheduleRefresh(); } } else { stopTimer(); }
    });
  }

  window.__myi = {parseCsv: parseCsv, buildXlsxBlob: buildXlsxBlob, buildXlsxParts: buildXlsxParts, buildZip: buildZip, S: S, start: start, run: run, download: download};
  init();
})();
</script>`;

        const json = (ctx, obj) => {
            ctx.response.setHeader({ name: 'Content-Type', value: 'application/json' });
            ctx.response.write(JSON.stringify(obj));
        };

        const getSftpConfig = (configId) => {
            const configRec = record.load({ type: CONFIG.CONFIG_RECORD, id: configId });
            if (configRec.getValue({ fieldId: 'isinactive' })) { throw new Error('MyInventory SFTP configuration is inactive.'); }
            const config = {
                host: String(configRec.getValue({ fieldId: 'custrecord_vs_myinv_sftp_host' }) || '').trim(),
                port: Number(configRec.getValue({ fieldId: 'custrecord_vs_myinv_sftp_port' }) || 22),
                username: String(configRec.getValue({ fieldId: 'custrecord_vs_myinv_sftp_username' }) || '').trim(),
                directory: String(configRec.getValue({ fieldId: 'custrecord_vs_myinv_sftp_directory' }) || '').trim(),
                hostKey: String(configRec.getValue({ fieldId: 'custrecord_vs_myinv_sftp_hostkey' }) || '').trim(),
                passwordGuid: "custsecret_vs_sym_sftp_password_guid" // the password is stored in a NetSuite secret, not in the config record. The config record only has the GUID.
            };
            if (!config.host || !config.username || !config.directory || !config.hostKey || !config.passwordGuid) {
                throw new Error('MyInventory SFTP configuration is missing host, username, directory, host key or password GUID. Check the configuration record selected on the Suitelet deployment.');
            }
            if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) { throw new Error('Invalid SFTP port.'); }
            return config;
        };

        const connect = () => {
            const configId = runtime.getCurrentScript().getParameter({ name: CONFIG.PARAM_SFTP_CONFIG });
            if (!configId) { throw new Error('Script parameter "' + CONFIG.PARAM_SFTP_CONFIG + '" is not set.'); }
            const config = getSftpConfig(configId);
            return sftp.createConnection({
                url: config.host,
                username: config.username,
                port: config.port,
                directory: config.directory,
                hostKey: config.hostKey,
                passwordGuid: config.passwordGuid
            });
        };

        const dateToNumber = (s) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) { throw new Error('Invalid date: ' + s); }
            return Number(s.replace(/-/g, ''));
        };

        const listFiles = (from, to) => {
            const fromNum = dateToNumber(from);
            const toNum = dateToNumber(to);
            if (fromNum > toNum) { throw new Error('Date From cannot be after Date To.'); }

            const connection = connect();
            const entries = connection.list({ path: '.', sort: sftp.Sort.NAME }) || [];
            const files = [];
            entries.forEach((e) => {
                if (e.directory) { return; }
                const m = CONFIG.FILE_REGEX.exec(e.name);
                if (!m) { return; }
                const dateNum = Number(m[1] + m[2] + m[3]);
                if (dateNum < fromNum || dateNum > toNum) { return; }
                files.push({
                    name: e.name,
                    date: m[1] + '-' + m[2] + '-' + m[3],
                    seq: Number(m[4]),
                    dateNum: dateNum,
                    size: e.size
                });
            });
            files.sort((a, b) => (a.dateNum - b.dateNum) || (a.seq - b.seq));
            return files;
        };

        const readFile = (name) => {
            if (!CONFIG.FILE_REGEX.test(name || '')) { throw new Error('Invalid file name.'); }
            const connection = connect();
            const downloaded = connection.download({ filename: name });
            return downloaded.getContents();
        };

        const mainPage = (ctx) => {
            const script = runtime.getCurrentScript();
            const base = url.resolveScript({ scriptId: script.id, deploymentId: script.deploymentId });
            const form = serverWidget.createForm({ title: 'MyInventory - SFTP Files Export' });
            const html = form.addField({ id: 'custpage_html', type: serverWidget.FieldType.INLINEHTML, label: ' ' });
            html.defaultValue = CLIENT_HTML.split('__URL__').join(base);
            ctx.response.writePage(form);
        };

        const onRequest = (ctx) => {
            const p = ctx.request.parameters;
            try {
                if (p.action === 'list') { return json(ctx, { success: true, files: listFiles(p.from, p.to) }); }
                if (p.action === 'file') { return json(ctx, { success: true, name: p.name, content: readFile(p.name) }); }
                return mainPage(ctx);
            } catch (e) {
                log.error({ title: 'MyInventory SFTP Export', details: e });
                if (p.action === 'list' || p.action === 'file') {
                    return json(ctx, { success: false, message: e.message || String(e) });
                }
                ctx.response.write('Error: ' + (e.message || e));
            }
        };

        return { onRequest };
    });