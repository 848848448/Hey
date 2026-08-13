// ==============================================
// PASTE THIS CODE INTO GOOGLE APPS SCRIPT
// ==============================================
// 1. Go to https://script.google.com
// 2. Create a new project
// 3. Paste this entire code
// 4. Click Deploy > New deployment > Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy the deployment URL
// 6. Paste it into SCRIPT_URL in index.html and admin.html
// ==============================================

var SHEET_NAME = 'Submissions';

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  var sheet = getOrCreateSheet();
  var data = JSON.parse(e.postData.contents);

  var row = [
    new Date().toISOString(),
    data.fullName || '',
    data.phone || '',
    data.email || '',
    data.language || '',
    (data.preferredTime || []).join(', '),
    data.consent ? 'Yes' : 'No'
  ];

  sheet.appendRow(row);
  lock.releaseLock();

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', row: sheet.getLastRow() }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var sheet = getOrCreateSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    rows.push(obj);
  }

  return ContentService
    .createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Timestamp',
      'Full Name',
      'Phone',
      'Email',
      'Language',
      'Preferred Time',
      'Consent'
    ]);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
  }

  return sheet;
}
