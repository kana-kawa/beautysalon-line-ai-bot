/**
 * 止まったときに気づく仕組み。
 *   - エラーが出たら開発者にメールで知らせる（notifyDeveloper_）
 *   - 毎朝、LINE・AI・スプレッドシート・カレンダーが使えるかを確かめる（dailyCheck）
 *   - 毎朝、古い記録を消す（質問の記録は6か月、AIを止めているお客様は再開の日時を過ぎた行）
 *
 * 開発者へのメールの送り先はスクリプト プロパティ DEVELOPER_EMAIL。
 * 未設定なら、このスクリプトを動かしているアカウントに送る。
 * 開発者へのメールには、お客様の言葉・名前・LINEのIDは書かない。
 */

/** 毎朝のチェックを動かす時（0〜23） */
const DAILY_CHECK_HOUR_ = 7;
/** 同じ内容のエラーのメールは、この時間（秒）に1通まで */
const DEVELOPER_MAIL_INTERVAL_SEC_ = 60 * 60;
/** 質問の記録を残す月数。スクリプト プロパティ LOG_RETENTION_MONTHS で変えられる */
const LOG_RETENTION_MONTHS_DEFAULT_ = 6;

/**
 * 開発者にエラーを知らせる。メールが送れなくても、ここで処理は止めない。
 * @param {string} where どの処理で起きたか（例：「お客様への返信」）
 * @param {*} err
 */
function notifyDeveloper_(where, err) {
  const message = err && err.message ? err.message : String(err);
  console.error(where + ': ' + (err && err.stack ? err.stack : message));
  try {
    const cache = CacheService.getScriptCache();
    const key = 'devmail:' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, where + message));
    if (cache.get(key)) return;
    cache.put(key, '1', DEVELOPER_MAIL_INTERVAL_SEC_);

    MailApp.sendEmail({
      to: getConfig_('DEVELOPER_EMAIL', false) || Session.getEffectiveUser().getEmail(),
      subject: '【LINE AI自動応答】エラー：' + where,
      body: [
        'LINE AI自動応答でエラーが出ました。',
        '',
        '■ 日時：' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年M月d日 HH:mm'),
        '■ 処理：' + where,
        '■ エラー：' + message.slice(0, 1000),
        '',
        'くわしくは Apps Script の「実行数」で確かめてください。',
        'https://script.google.com/home/projects/' + ScriptApp.getScriptId() + '/executions',
        '',
        '※ 同じエラーは' + (DEVELOPER_MAIL_INTERVAL_SEC_ / 60) + '分に1通だけ送ります。',
      ].join('\n'),
      name: 'LINE AI自動応答',
    });
  } catch (mailErr) {
    console.error('開発者へのメールを送れませんでした: ' + mailErr.message);
  }
}

/** 毎朝のチェック。トリガーから動く（setupDailyTrigger で登録）。 */
function dailyCheck() {
  const checks = [
    ['LINE', checkLine_],
    ['お店の情報のスプレッドシート', function () { loadShopInfoText_(); }],
    ['記録のスプレッドシート', function () { SpreadsheetApp.openById(getConfig_('LOG_SHEET_ID')).getSheetByName('質問の記録').getLastRow(); }],
    ['カレンダー（祝日・お店のお知らせ）', checkCalendars_],
    ['AI（Claude API）', checkAi_],
    ['古い記録の削除', cleanupOldRecords_],
  ];
  const failed = [];
  checks.forEach(function (c) {
    try {
      c[1]();
    } catch (err) {
      failed.push(c[0]);
      notifyDeveloper_('毎朝のチェック（' + c[0] + '）', err);
    }
  });
  console.log(failed.length ? '使えなかったもの：' + failed.join('、') : '毎朝のチェック：すべて使えました');
}

/** LINE のチャネルアクセストークンが使えるか。 */
function checkLine_() {
  const res = UrlFetchApp.fetch(LINE_API_BASE_ + '/info', {
    headers: { Authorization: 'Bearer ' + getConfig_('LINE_CHANNEL_ACCESS_TOKEN') },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('LINE の API が使えません: ' + res.getResponseCode() + ' ' + res.getContentText());
  }
}

/** カレンダーを読めるか（ふだんの返信では、読めなくても止めずに続けるので、ここで気づく）。 */
function checkCalendars_() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cal = loadCalendarNotes_(today, CALENDAR_DAYS_);
  if (cal.failed.length) throw new Error(cal.failed.join('・') + 'のカレンダーを読めません');
}

/**
 * AI が答えられるか（APIキー・残高・モデルの提供終了などに気づくため）。
 * ふだんと同じ指示とお店の情報で、あいさつを1つ聞く。1回 0.1円ほど。
 */
function checkAi_() {
  const r = askClaude_('こんにちは', []);
  if (!r || typeof r.reply !== 'string' || r.reply === '') throw new Error('AI の返信が空でした');
}

/** 古い記録を消す。 */
function cleanupOldRecords_() {
  const ss = SpreadsheetApp.openById(getConfig_('LOG_SHEET_ID'));

  // 質問の記録：日時が古い順に並んでいるので、上から古い行をまとめて消す
  const months = Number(getConfig_('LOG_RETENTION_MONTHS', false)) || LOG_RETENTION_MONTHS_DEFAULT_;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const log = ss.getSheetByName('質問の記録');
  let oldRows = 0;
  if (log.getLastRow() >= 2) {
    const dates = log.getRange(2, 1, log.getLastRow() - 1, 1).getValues();
    while (oldRows < dates.length && dates[oldRows][0] instanceof Date && dates[oldRows][0] < cutoff) oldRows++;
    if (oldRows) log.deleteRows(2, oldRows);
  }

  // AIを止めているお客様：再開する日時を過ぎた行（下から消すと行番号がずれない）
  const pause = ss.getSheetByName(PAUSE_SHEET_);
  let expired = 0;
  if (pause.getLastRow() >= 2) {
    const resumeAts = pause.getRange(2, 4, pause.getLastRow() - 1, 1).getValues();
    for (let i = resumeAts.length - 1; i >= 0; i--) {
      if (!(resumeAts[i][0] instanceof Date) || resumeAts[i][0].getTime() <= Date.now()) {
        pause.deleteRow(i + 2);
        expired++;
      }
    }
  }
  console.log('古い記録を消しました：質問の記録 ' + oldRows + '行（' + months + 'か月より前）、AIを止めているお客様 ' + expired + '行');
}

/** 毎朝のチェックのトリガーを登録する。GAS のエディタから1回だけ手で実行する（2回実行しても1つだけになる）。 */
function setupDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'dailyCheck'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyCheck').timeBased().everyDays(1).atHour(DAILY_CHECK_HOUR_).inTimezone('Asia/Tokyo').create();
  console.log('毎朝' + DAILY_CHECK_HOUR_ + '時台に dailyCheck が動くように登録しました');
}

/** 開発者へのエラーのメールを試す。GAS のエディタから手で実行する。 */
function testNotifyDeveloper() {
  notifyDeveloper_('テスト送信', new Error('これはテストです（' + new Date().getTime() + '）'));
  console.log('送信しました: ' + (getConfig_('DEVELOPER_EMAIL', false) || Session.getEffectiveUser().getEmail()));
}
