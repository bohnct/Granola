/**
 * Grain app <-> Google Sheet bridge.
 *
 * Setup (once):
 *  1. Create a Google Sheet. Extensions > Apps Script. Paste this file in as Code.gs.
 *  2. Project Settings > Script properties > add  TOKEN = <a long secret passphrase>.
 *  3. Run the `setup` function once (authorize when asked). It creates the tabs + headers.
 *  4. Deploy > New deployment > type "Web app":
 *       Execute as: Me      Who has access: Anyone
 *     Copy the Web app URL into the app's Settings, along with the same TOKEN.
 *  After editing this script, use Deploy > Manage deployments > Edit > New version
 *  so the same URL keeps working.
 *
 * Every request is a POST with a text/plain JSON body (avoids CORS preflight):
 *   {token, action: 'list'}
 *   {token, action: 'upsert', table: 'Sales'|'CropYears'|'Targets', row: {...}}
 *   {token, action: 'delete', table, id}
 */

var TABLES = {
  CropYears: ['id', 'year', 'commodity', 'producedBu', 'targetSellBu', 'notes', 'updatedAt'],
  Targets: ['id', 'cropYearId', 'commodity', 'year', 'qty', 'qtyUnit', 'price', 'priceUnit', 'notes', 'updatedAt'],
  Sales: ['id', 'date', 'commodity', 'cropYearId', 'year', 'buyer', 'contractNo', 'type', 'deliveryMonth',
          'qty', 'qtyUnit', 'price', 'priceUnit', 'bushels', 'tonnes', 'pricePerBu', 'pricePerMt', 'value',
          'delivered', 'notes', 'updatedAt'],
};

function setup() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(TABLES).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var cols = TABLES[name];
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!token || req.token !== token) return reply({ ok: false, error: 'Bad token' });

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (req.action === 'list') {
        var out = { ok: true };
        Object.keys(TABLES).forEach(function (t) { out[t] = readTable(t); });
        return reply(out);
      }
      if (!TABLES[req.table]) return reply({ ok: false, error: 'Unknown table ' + req.table });
      if (req.action === 'upsert') return reply({ ok: true, row: upsert(req.table, req.row) });
      if (req.action === 'delete') return reply({ ok: true, deleted: remove(req.table, req.id) });
      return reply({ ok: false, error: 'Unknown action ' + req.action });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function doGet() {
  return reply({ ok: true, message: 'Grain app bridge is running. Use POST.' });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet(table) {
  var sh = SpreadsheetApp.getActive().getSheetByName(table);
  if (!sh) { setup(); sh = SpreadsheetApp.getActive().getSheetByName(table); }
  return sh;
}

// Headers come from row 1, so you can add your own extra columns to the right.
function headers(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

function readTable(table) {
  var sh = sheet(table);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var hdr = headers(sh);
  var tz = Session.getScriptTimeZone();
  return sh.getRange(2, 1, last - 1, hdr.length).getValues()
    .filter(function (r) { return r[0] !== ''; })
    .map(function (r) {
      var o = {};
      hdr.forEach(function (h, i) {
        var v = r[i];
        if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
        o[h] = v;
      });
      return o;
    });
}

function findRow(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function upsert(table, row) {
  if (!row || !row.id) throw new Error('row.id required');
  var sh = sheet(table);
  var hdr = headers(sh);
  row.updatedAt = new Date().toISOString();
  var at = findRow(sh, row.id);
  var existing = at > 0 ? sh.getRange(at, 1, 1, hdr.length).getValues()[0] : [];
  // Keep values in columns the app doesn't know about (user-added columns).
  var values = hdr.map(function (h, i) {
    return Object.prototype.hasOwnProperty.call(row, h) ? row[h] : (existing[i] !== undefined ? existing[i] : '');
  });
  if (at > 0) sh.getRange(at, 1, 1, hdr.length).setValues([values]);
  else sh.appendRow(values);
  return row;
}

function remove(table, id) {
  var sh = sheet(table);
  var at = findRow(sh, id);
  if (at > 0) { sh.deleteRow(at); return true; }
  return false;
}
