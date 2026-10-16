/**
 * LINE からの Webhook を受け取る入口。
 *
 * GAS では x-line-signature ヘッダーを読めないため、署名の検証ができない。
 * 代わりに、Webhook URL の秘密の文字列（?key=...）と destination で本物かを確かめる。
 *
 * 質問を AI に渡して返信し、質問の記録シートに残す。
 */
function doPost(e) {
  const started = Date.now();

  if (!e || !e.parameter || e.parameter.key !== getConfig_('WEBHOOK_KEY')) {
    return jsonOutput_({ ok: false });
  }

  const body = JSON.parse(e.postData.contents);
  const botUserId = getConfig_('LINE_BOT_USER_ID', false);
  if (botUserId && body.destination !== botUserId) {
    return jsonOutput_({ ok: false });
  }

  (body.events || []).forEach(function (event) {
    try {
      handleEvent_(event);
    } catch (err) {
      notifyDeveloper_('LINEのメッセージの処理', err);
    }
  });

  console.log('処理時間: ' + (Date.now() - started) + 'ms');
  return jsonOutput_({ ok: true });
}

/** AI が使えないときにお客様へ返す文 */
const FALLBACK_REPLY_ = 'お問い合わせありがとうございます。担当者から返信いたしますので、少しお待ちください。';

function handleEvent_(event) {
  if (event.type !== 'message' || !event.replyToken) return;

  // オーナー様が対応中のお客様には AI は何も返さない（メッセージは LINE のチャット画面に届いている）
  const userId = event.source && event.source.userId;
  if (userId && isPaused_(userId)) return;

  if (event.message.type !== 'text') {
    replyText_(event.replyToken, ['申し訳ありません。画像やスタンプにはお答えできません。ご質問は文字で送ってください。']);
    return;
  }

  // AI と記録には、電話番号などを置き換えた文だけを使う
  const question = maskPersonalInfo_(event.message.text);
  const history = userId ? loadHistory_(userId) : [];

  let result;
  try {
    result = askClaude_(question, history);
  } catch (err) {
    notifyDeveloper_('AI（Claude API）', err);
    result = { reply: FALLBACK_REPLY_, escalate: true, reason: 'AIが使えなかった' };
  }

  replyText_(event.replyToken, [result.reply]);
  if (userId) saveHistory_(userId, history, question, result.reply);
  appendQuestionLog_(question, result);
  if (result.escalate) {
    const displayName = userId ? getDisplayName_(userId) : '';
    const token = userId ? pauseAi_(userId, displayName) : '';
    notifyOwner_(displayName, question, result, token);
  }
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** WEBHOOK_KEY を作って保存する。GAS のエディタから1回だけ手で実行する。 */
function setupWebhookKey() {
  const key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('WEBHOOK_KEY', key);
  console.log('WEBHOOK_KEY を保存しました。Webhook URL の末尾に ?key=' + key + ' を付けてください');
}
