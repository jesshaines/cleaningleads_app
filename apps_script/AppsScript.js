/**
 * Colony Surf Cleaning — Google Apps Script Backend
 * Paste this entire file into the Apps Script editor.
 *
 * SETUP:
 *  1. Open https://script.google.com → New project
 *  2. Paste this code, replacing any default content.
 *  3. Update WORKER_KEY and SHEET_ID below.
 *  4. Deploy → New deployment → Web app
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  5. Copy the Web App URL and store it in your Worker as APPS_SCRIPT_URL secret.
 *
 * SECURITY NOTE:
 *  The Apps Script URL is technically public, but requests without
 *  the correct X-WORKER-KEY header are rejected with a 403 response.
 */

// ── Configuration ─────────────────────────────────────────────
// Replace with the same value you set for WORKER_KEY in your Cloudflare Worker.
var WORKER_KEY = 'LevGeorgiaAltonZoeKeltonJaden';

// The ID of your Google Sheet (from its URL:
//   https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit)
var SHEET_ID = '18VPlnIOCHAUsg2_wibq16n--_4yWoHFyC4rZ7Uw5KzU';

// Name of the tab to write bookings to.
var TAB_NAME = 'Bookings';

// ── Column order ──────────────────────────────────────────────
var COLUMNS = [
  '_id',
  '_created_at',
  'client_name',
  'phone',
  'address',
  'beds_baths',
  'property_type',
  'approx_sq_ft',
  'property_size_category',
  'service_type',
  'access',
  'pets',
  'notes',
  'service_date',
  'arrival_time',
  'suggested_price_low',
  'suggested_price_high',
];

// ── doPost handler ────────────────────────────────────────────
function doPost(e) {
  try {
    // Validate WORKER_KEY header
    var workerKey = e.parameter['X-WORKER-KEY']
      || (e.headers && e.headers['X-WORKER-KEY'])
      || '';

    // Apps Script doesn't expose custom request headers via e.parameter.
    // The Worker must send X-WORKER-KEY as a query param fallback, OR
    // we embed it in the JSON body as __workerKey.
    var body = {};
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonError('Invalid JSON body', 400);
    }

    var receivedKey = body.__workerKey || workerKey;
    if (receivedKey !== WORKER_KEY) {
      return jsonError('Forbidden: invalid worker key', 403);
    }

    // Access the sheet
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(TAB_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(TAB_NAME);
    }

    // Add header row if the sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(COLUMNS);
      // Basic header formatting
      var headerRange = sheet.getRange(1, 1, 1, COLUMNS.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#0d2240');
      headerRange.setFontColor('#ffffff');
    }

    // Build the row
    var row = COLUMNS.map(function(col) {
      if (col === '__workerKey') return ''; // never write the key
      var val = body[col];
      return (val === null || val === undefined) ? '' : String(val);
    });

    // Append the row
    sheet.appendRow(row);

    return jsonOk();

  } catch (err) {
    return jsonError('Internal error: ' + err.message, 500);
  }
}

// ── doGet handler (health check) ─────────────────────────────
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'Colony Surf Cleaning Apps Script' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Helpers ───────────────────────────────────────────────────
function jsonOk() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(message, status) {
  // Apps Script can't set HTTP status codes via ContentService,
  // but we include them in the body for the Worker to read.
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: message, status: status || 500 }))
    .setMimeType(ContentService.MimeType.JSON);
}
