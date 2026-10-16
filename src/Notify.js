/**
 * オーナー様へのお知らせ（メール）。
 * 送り先はスクリプト プロパティ OWNER_EMAIL。未設定なら、このスクリプトを動かしているアカウントに送る。
 */

/**
 * オーナー様に回した質問をメールで知らせる。
 * @param {string} displayName お客様の LINE の表示名（取れなければ空文字）
 * @param {string} question お客様の質問（置き換え済み）
 * @param {{reply: string, reason: string}} result AI の返信と、回した理由
 * @param {string} resumeToken AI の返信に戻すための番号（AI を止めていなければ空文字）
 */
function notifyOwner_(displayName, question, result, resumeToken) {
  const name = displayName ? displayName + ' 様' : '（表示名を取得できませんでした）';
  const lines = [
    'LINEで、AIが答えられない質問がありました。',
    'LINE公式アカウントのチャット画面から、お客様に返信してください。',
    'https://chat.line.biz/',
    '',
  ];
  if (resumeToken) {
    lines.push(
      'このお客様には、これから' + PAUSE_HOURS_ + '時間、AIは返信しません。',
      '対応が終わって、早めにAIの返信に戻したいときは、次のリンクを開いてください。',
      resumeUrl_(resumeToken),
      '');
  }
  lines.push(
    '■ お客様：' + name,
    '■ 日時：' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年M月d日 HH:mm'),
    '■ 理由：' + result.reason,
    '',
    '■ 質問',
    question,
    '',
    '■ AIがお客様に返した文',
    result.reply,
    '',
    '※ 電話番号やメールアドレスは「＊＊＊」に置き換えています。全文はLINEのチャット画面で見られます。');
  const body = lines.join('\n');

  MailApp.sendEmail({
    to: getConfig_('OWNER_EMAIL', false) || Session.getEffectiveUser().getEmail(),
    subject: '【LINE】お客様への返信をお願いします（' + name + '）',
    body: body,
    name: 'LINE AI自動応答',
  });
}

/** メールの送信を試す。GAS のエディタから手で実行する（初回はメール送信の許可を求められる）。 */
function testNotifyOwner() {
  notifyOwner_('テスト', '明日の14時に予約できますか？', {
    reply: '確認して、担当者からお返事いたします。少しお待ちください。',
    reason: '予約の空き状況の確認（テスト送信）',
  });
  console.log('送信しました: ' + (getConfig_('OWNER_EMAIL', false) || Session.getEffectiveUser().getEmail()));
}
