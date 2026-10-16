/**
 * AIに送る前に、お客様が書いた個人情報らしい文字列を「＊＊＊」に置き換える。
 * 対象：電話番号、メールアドレス、クレジットカード番号らしい数字の並び。
 * 全角の数字・記号（０９０－１２３４－５６７８ など）にも対応する。
 */
const MASK_ = '＊＊＊';

const DIGIT_ = '[0-9０-９]';
// 電話番号の区切りとして使われがちな文字（ハイフン各種・空白・かっこ）
const PHONE_SEP_ = '[\\s\\-－ー‐−―()（）]{0,2}';

const MASK_PATTERNS_ = [
  // メールアドレス（全角の＠も含む）
  /[A-Za-z0-9._%+\-]+[@＠][A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}/g,
  // クレジットカード番号らしい並び（4桁ずつ、13〜16桁）
  new RegExp(DIGIT_ + '{4}(?:[\\s\\-－]?' + DIGIT_ + '{4}){2}[\\s\\-－]?' + DIGIT_ + '{1,4}', 'g'),
  // 電話番号（0または+81で始まり、合計10〜11桁）
  new RegExp('[(（]?(?:[+＋]81|[0０])(?:' + PHONE_SEP_ + DIGIT_ + '){9,10}(?!' + DIGIT_ + ')', 'g'),
];

/**
 * @param {string} text
 * @return {string} 置き換え後の文字列
 */
function maskPersonalInfo_(text) {
  if (!text) return text;
  return MASK_PATTERNS_.reduce(function (s, re) { return s.replace(re, MASK_); }, text);
}
