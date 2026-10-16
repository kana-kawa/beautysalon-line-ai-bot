/**
 * オーナー様が対応しているお客様には、AI が一定時間返信しない。
 * 止めているお客様は記録シートの「AIを止めているお客様」に1行ずつ置く。
 * オーナー様は、お知らせメールのリンクか、その行を消すことで、すぐに AI の返信に戻せる。
 */
const PAUSE_HOURS_ = 24;
const PAUSE_SHEET_ = 'AIを止めているお客様';

/** このお客様に AI が返信しないでよいか。再開する日時を過ぎた行はここで消す。 */
function isPaused_(userId) {
  const sheet = getPauseSheet_();
  const row = findPauseRow_(sheet, userId);
  if (!row) return false;
  const resumeAt = sheet.getRange(row, 4).getValue();
  if (resumeAt instanceof Date && resumeAt.getTime() > Date.now()) return true;
  sheet.deleteRow(row);
  return false;
}

/**
 * AI を止める。すでに止めていれば、再開する日時を延ばす。
 * @return {string} メールのリンクで再開するための番号
 */
function pauseAi_(userId, displayName) {
  const sheet = getPauseSheet_();
  if (sheet.getRange(1, 5).getValue() === '') sheet.getRange(1, 5).setValue('再開用の番号').setFontWeight('bold').setBackground('#f1f3f4');
  const now = new Date();
  const token = Utilities.getUuid();
  const values = [[userId, asPlainText_(displayName), now, new Date(now.getTime() + PAUSE_HOURS_ * 60 * 60 * 1000), token]];
  const row = findPauseRow_(sheet, userId);
  if (row) {
    sheet.getRange(row, 1, 1, 5).setValues(values);
  } else {
    sheet.appendRow(values[0]);
  }
  return token;
}

/** メールに載せる「AIの返信に戻す」リンク */
function resumeUrl_(token) {
  return ScriptApp.getService().getUrl() + '?resume=' + token;
}

/**
 * お知らせメールのリンクを開いたときの画面。
 * 1回目は確認の画面を出し、ボタンを押したら再開する（メールのリンクを自動で開くしくみで勝手に再開しないように）。
 */
function doGet(e) {
  const token = e && e.parameter && e.parameter.resume;
  const sheet = getPauseSheet_();
  const row = token ? findPauseRowByToken_(sheet, token) : 0;
  if (!row) {
    return resumePage_('このお客様は、すでにAIの返信に戻っています。');
  }
  const name = sheet.getRange(row, 2).getDisplayValue() || 'このお客様';
  if (e.parameter.confirm !== '1') {
    const url = resumeUrl_(token) + '&confirm=1';
    return resumePage_(escapeHtml_(name) + ' 様への返信を、AIに戻しますか？<br>（オーナー様の対応が終わってから押してください）',
      '<a class="btn" href="' + url + '" target="_top">AIの返信に戻す</a>');
  }
  sheet.deleteRow(row);
  return resumePage_(escapeHtml_(name) + ' 様への返信を、AIに戻しました。<br>この画面は閉じてかまいません。');
}

function resumePage_(message, button) {
  const html = '<style>body{font-family:sans-serif;padding:24px 16px;font-size:18px;line-height:1.7;color:#222}'
    + '.btn{display:block;margin-top:24px;padding:16px;background:#06c755;color:#fff;text-align:center;border-radius:8px;text-decoration:none;font-weight:bold}</style>'
    + '<p>' + message + '</p>' + (button || '');
  return HtmlService.createHtmlOutput(html).setTitle('LINE AI自動応答').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function escapeHtml_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function getPauseSheet_() {
  return SpreadsheetApp.openById(getConfig_('LOG_SHEET_ID')).getSheetByName(PAUSE_SHEET_);
}

/** @return {number} 行番号。なければ 0 */
function findPauseRow_(sheet, userId) {
  if (sheet.getLastRow() < 2) return 0;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === userId) return i + 2;
  }
  return 0;
}

/** @return {number} 行番号。なければ 0 */
function findPauseRowByToken_(sheet, token) {
  if (sheet.getLastRow() < 2 || sheet.getLastColumn() < 5) return 0;
  const tokens = sheet.getRange(2, 5, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i][0] === token) return i + 2;
  }
  return 0;
}
