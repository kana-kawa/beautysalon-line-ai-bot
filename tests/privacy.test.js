// GAS のファイルを Node で読み込んで確かめる。実行：node --test tests
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/Privacy.js'), 'utf8'), ctx);
const mask = (s) => vm.runInContext('maskPersonalInfo_', ctx)(s);

test('電話番号を置き換える', () => {
  for (const s of [
    '090-1234-5678',
    '09012345678',
    '０９０－１２３４－５６７８',
    '03-1234-5678',
    '(03)1234-5678',
    '090 1234 5678',
    '+81 90-1234-5678',
    '0120-123-456',
  ]) {
    assert.strictEqual(mask(`電話は${s}です`), '電話は＊＊＊です', s);
  }
});

test('メールアドレスを置き換える', () => {
  assert.strictEqual(mask('連絡先 taro.yamada@example.co.jp まで'), '連絡先 ＊＊＊ まで');
  assert.strictEqual(mask('taro＠example.com'), '＊＊＊');
});

test('カード番号らしい並びを置き換える', () => {
  assert.strictEqual(mask('4111 1111 1111 1111'), '＊＊＊');
  assert.strictEqual(mask('4111-1111-1111-1111'), '＊＊＊');
});

test('ふつうの質問は変えない', () => {
  for (const s of [
    'カットは5,000円ですか？',
    '10月15日の10:00に予約できますか',
    '2026-10-15 10:00 は空いていますか',
    '駐車場は何台ありますか',
    '営業時間は9時〜19時ですか',
    'カラーとトリートメントで12,000円くらい？',
    '',
  ]) {
    assert.strictEqual(mask(s), s, s);
  }
});
