/**
 * 最初に1回だけ GAS のエディタから手で実行する関数。
 * 本番（お店のアカウント）に移すときも、同じ順に実行すれば同じ形で作り直せる。
 *   1. setupWebhookKey（Main.js）
 *   2. スクリプト プロパティに LINE_CHANNEL_ACCESS_TOKEN を登録
 *   3. setupBotUserId
 *   4. setupSpreadsheets
 *   5. setupShopCalendar（Calendar.js。お店のアカウントで作り、オーナー様のGoogleアカウントに「予定の変更」の権限で共有する）
 *   6. スクリプト プロパティに DEVELOPER_EMAIL を登録 → setupDailyTrigger（Monitor.js）
 */

/** ボットのユーザーIDを LINE から取得して保存する（Webhook の destination と照合するため）。 */
function setupBotUserId() {
  const res = UrlFetchApp.fetch(LINE_API_BASE_ + '/info', {
    headers: { Authorization: 'Bearer ' + getConfig_('LINE_CHANNEL_ACCESS_TOKEN') },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('ボットの情報を取得できませんでした: ' + res.getResponseCode() + ' ' + res.getContentText());
  }
  const info = JSON.parse(res.getContentText());
  PropertiesService.getScriptProperties().setProperty('LINE_BOT_USER_ID', info.userId);
  console.log('LINE_BOT_USER_ID を保存しました（' + info.displayName + '）');
}

/** スプレッドシートの形。列の並びを変えるときはここを直す。 */
const SHEETS_ = {
  shop: {
    property: 'SHOP_SHEET_ID',
    title: 'お店の情報',
    sheets: [
      {
        name: '基本情報',
        header: ['項目', '内容'],
        rows: [
          ['店名', ''], ['住所', ''], ['アクセス', ''], ['電話番号', ''],
          ['営業時間', ''], ['定休日', ''], ['駐車場', ''], ['予約の方法', ''], ['支払い方法', ''],
        ],
        widths: [160, 480],
      },
      {
        name: 'メニュー',
        header: ['カテゴリ', 'メニュー名', '料金（税込）', '所要時間の目安', '説明'],
        rows: [],
        widths: [120, 200, 120, 130, 360],
      },
      {
        name: 'よくある質問',
        header: ['質問', '回答'],
        rows: [],
        widths: [320, 480],
      },
    ],
  },
  log: {
    property: 'LOG_SHEET_ID',
    title: '記録（お客様の情報あり・共有しない）',
    sheets: [
      {
        name: '質問の記録',
        header: ['日時', '質問', 'AIの回答', 'オーナー様に回した', '理由'],
        rows: [],
        widths: [150, 320, 320, 130, 240],
      },
      {
        name: 'AIを止めているお客様',
        header: ['LINEのID', '表示名', '止めた日時', '再開する日時', '再開用の番号'],
        rows: [],
        widths: [300, 160, 150, 150, 300],
      },
    ],
  },
};

/** 「お店の情報」と「記録」のスプレッドシートを作る。作成済みなら何もしない。 */
function setupSpreadsheets() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(SHEETS_).forEach(function (key) {
    const def = SHEETS_[key];
    const existing = props.getProperty(def.property);
    if (existing) {
      console.log(def.title + ' は作成済みです: ' + SpreadsheetApp.openById(existing).getUrl());
      return;
    }
    const ss = SpreadsheetApp.create(def.title);
    def.sheets.forEach(function (s, i) {
      const sheet = i === 0 ? ss.getSheets()[0].setName(s.name) : ss.insertSheet(s.name);
      const values = [s.header].concat(s.rows);
      sheet.getRange(1, 1, values.length, s.header.length).setValues(values);
      sheet.getRange(1, 1, 1, s.header.length).setFontWeight('bold').setBackground('#f1f3f4');
      sheet.setFrozenRows(1);
      s.widths.forEach(function (w, c) { sheet.setColumnWidth(c + 1, w); });
    });
    props.setProperty(def.property, ss.getId());
    console.log(def.title + ' を作成しました: ' + ss.getUrl());
  });
}
