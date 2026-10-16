/**
 * 設定値の読み出し。
 * 秘密の値はコードに書かず、GASの「スクリプト プロパティ」に保存する。
 *
 * 必要なプロパティ：
 *   LINE_CHANNEL_ACCESS_TOKEN … LINE Messaging API のチャネルアクセストークン（長期）
 *   WEBHOOK_KEY               … Webhook URL に付ける秘密の文字列（?key=...）
 *   LINE_BOT_USER_ID          … ボットのユーザーID（Webhookの destination と照合する。未設定なら照合しない）
 *   ANTHROPIC_API_KEY         … Claude API の APIキー
 *   OWNER_EMAIL               … オーナー様へのお知らせの送り先（未設定ならスクリプトを動かしているアカウント）
 *   DEVELOPER_EMAIL           … エラーのお知らせの送り先（未設定ならスクリプトを動かしているアカウント）
 *   LOG_RETENTION_MONTHS      … 質問の記録を残す月数（未設定なら6）
 *   SHOP_CALENDAR_ID          … お店のお知らせのカレンダー（setupShopCalendar で登録）
 *   SHOP_SHEET_ID / LOG_SHEET_ID … お店の情報・記録のスプレッドシート（setupSpreadsheets で登録）
 */
function getConfig_(name, required) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (required !== false && !value) {
    throw new Error('スクリプト プロパティ ' + name + ' が設定されていません');
  }
  // 貼り付けたときに前後に入った空白や改行は取り除く
  return value ? value.trim() : value;
}
