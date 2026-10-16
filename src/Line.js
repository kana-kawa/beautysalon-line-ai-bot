/**
 * LINE Messaging API の呼び出し。
 */
const LINE_API_BASE_ = 'https://api.line.me/v2/bot';

/**
 * 応答メッセージを送る（通数に数えない）。
 * @param {string} replyToken Webhook で受け取った replyToken
 * @param {string[]} texts 送るテキスト（最大5件）
 */
function replyText_(replyToken, texts) {
  const res = UrlFetchApp.fetch(LINE_API_BASE_ + '/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + getConfig_('LINE_CHANNEL_ACCESS_TOKEN') },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: texts.slice(0, 5).map(function (t) { return { type: 'text', text: t }; }),
    }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('LINEへの返信に失敗しました: ' + res.getResponseCode() + ' ' + res.getContentText());
  }
}

/**
 * お客様の表示名を取得する。取れないとき（ブロックされているなど）は空文字を返す。
 * @param {string} userId
 */
function getDisplayName_(userId) {
  const res = UrlFetchApp.fetch(LINE_API_BASE_ + '/profile/' + encodeURIComponent(userId), {
    headers: { Authorization: 'Bearer ' + getConfig_('LINE_CHANNEL_ACCESS_TOKEN') },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) return '';
  return JSON.parse(res.getContentText()).displayName || '';
}
