# セットアップ手順書（開発者向け）

このプロジェクトを引き継ぐ人が、開発環境を作り、本番（お店のアカウント）に移すまでの手順です。オーナー様向けの使い方は [使い方マニュアル](https://kana-kawa.github.io/beautysalon-line-ai-bot/docs/manual/) にあります。

しくみの全体像と、技術を選んだ理由は [README.md](../README.md) と [tech-selection.md](../tech-selection.md) を見てください。

## 全体の流れ

| 順番 | すること | だいたいの時間 |
|---|---|---|
| 1 | アカウントと道具をそろえる | 30分 |
| 2 | Apps Script のプロジェクトを作り、コードを送る | 15分 |
| 3 | 初回の関数を実行し、設定値を登録する | 20分 |
| 4 | ウェブアプリとしてデプロイし、LINE に Webhook URL を登録する | 15分 |
| 5 | 動作を確かめる | 20分 |

開発用と本番用で、同じ手順をそれぞれのアカウントで行います（本番に移すときの違いは「本番に移すとき」に書きました）。

## 1. アカウントと道具をそろえる

### アカウント

| アカウント | 使いみち | メモ |
|---|---|---|
| Google アカウント | Apps Script・スプレッドシート・カレンダー・Gmail | 本番は**お店名義**。開発用は自分のアカウントで構わない |
| LINE 公式アカウント | お客様とのやりとり | 開発用は、テスト用の公式アカウントを別に作る |
| LINE Developers | Messaging API のチャネル | LINE 公式アカウントの管理画面の「設定」→「Messaging API」で「利用する」を押すと作られる |
| Anthropic（Claude API） | AI の返信 | https://console.anthropic.com で API キーを発行する。前払いのクレジットを入れておく。本番は**お店名義**で、オーナー様のカードで払う |

### 手元の道具

- Git
- Node.js（LTS 版）
- clasp（Apps Script のコードを手元から送る道具）

```
npm install -g @google/clasp
clasp login
```

`clasp login` では、Apps Script を作る Google アカウントでログインします。あわせて https://script.google.com/home/usersettings を開き、「Google Apps Script API」をオンにしてください（オフだと clasp が使えません）。

## 2. Apps Script のプロジェクトを作り、コードを送る

```
git clone https://github.com/kana-kawa/beautysalon-line-ai-bot.git
cd beautysalon-line-ai-bot
```

1. https://script.google.com で「新しいプロジェクト」を作り、名前を付ける（例：「beautysalon-AIbot（開発）」）
2. 左の「プロジェクトの設定」（歯車）を開き、「スクリプト ID」をコピーする
3. `.clasp.json.example` を `.clasp.json` に写し、`scriptId` にコピーした ID を入れる
4. コードを送る

```
clasp push --force
```

- `.clasp.json` はスクリプト ID を含むので、Git には載せません（`.gitignore` 済み）
- `--force` は、`src/appsscript.json`（タイムゾーン、ウェブアプリの設定）の上書きを確認なしで行うために付けています
- `clasp create-script` でプロジェクトを作ると、`src/appsscript.json` が初期の内容で上書きされます。使う場合は先に控えを取ってください
- Apps Script のエディタでは、ファイル名が `.gs` に変わって見えます（`Main.js` → `Main.gs`）

## 3. 初回の関数を実行し、設定値を登録する

秘密の値（API キー、トークンなど）はコードに書かず、Apps Script の「スクリプト プロパティ」に保存します。登録は、エディタの「プロジェクトの設定」→「スクリプト プロパティ」で行います。値をチャットやコードに貼らないでください。

### 初回に実行する関数（この順に）

エディタの上の関数の一覧から選んで「実行」を押します。初めて実行するときは、Google の権限の確認画面が出るので許可します。

| 順番 | すること | どこにあるか | 結果 |
|---|---|---|---|
| 1 | `setupWebhookKey` を実行 | `Main.js` | `WEBHOOK_KEY` が保存され、ログに Webhook URL の末尾（`?key=...`）が出る |
| 2 | スクリプト プロパティに `LINE_CHANNEL_ACCESS_TOKEN` を登録 | LINE Developers の「Messaging API 設定」→「チャネルアクセストークン（長期）」で発行 | |
| 3 | `setupBotUserId` を実行 | `Setup.js` | `LINE_BOT_USER_ID` が保存される |
| 4 | `setupSpreadsheets` を実行 | `Setup.js` | 「お店の情報」と「記録」のスプレッドシートができ、ID が保存される |
| 5 | `setupShopCalendar` を実行 | `Calendar.js` | 「お店のお知らせ（LINEのAIが読みます）」カレンダーができ、ID が保存される |
| 6 | スクリプト プロパティに `ANTHROPIC_API_KEY` を登録 | Anthropic のコンソール | |
| 7 | スクリプト プロパティに `DEVELOPER_EMAIL`（と `OWNER_EMAIL`）を登録 → `setupDailyTrigger` を実行 | `Monitor.js` | 毎朝7時台に `dailyCheck` が動くようになる |

`setupSpreadsheets` と `setupShopCalendar` は、作成済みなら何もしません。`setupDailyTrigger` は、2回実行してもトリガーは1つです。

### スクリプト プロパティの一覧

| 名前 | 中身 | 登録のしかた |
|---|---|---|
| `WEBHOOK_KEY` | Webhook URL に付ける秘密の文字列 | `setupWebhookKey` |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE のチャネルアクセストークン（長期） | 手で登録 |
| `LINE_BOT_USER_ID` | ボットのユーザー ID（Webhook の destination と照合する） | `setupBotUserId` |
| `ANTHROPIC_API_KEY` | Claude API の API キー | 手で登録 |
| `SHOP_SHEET_ID` / `LOG_SHEET_ID` | お店の情報・記録のスプレッドシート | `setupSpreadsheets` |
| `SHOP_CALENDAR_ID` | お店のお知らせのカレンダー | `setupShopCalendar` |
| `OWNER_EMAIL` | オーナー様へのお知らせの送り先（なければ動かしているアカウント） | 手で登録（任意） |
| `DEVELOPER_EMAIL` | エラーのお知らせの送り先（なければ動かしているアカウント） | 手で登録（任意） |
| `LOG_RETENTION_MONTHS` | 質問の記録を残す月数（なければ6） | 手で登録（任意） |

同じ一覧は `src/Config.js` の先頭にもあります。

### お店の情報を入れる

できた「お店の情報」のスプレッドシートに、「基本情報」「メニュー」「よくある質問」を入れます。見出しの行とタブの名前は変えないでください（コードが名前で読んでいます）。列の形を変えるときは、`src/Setup.js` の `SHEETS_` と `src/Ai.js` の `loadShopInfoText_` を直します。

## 4. デプロイし、LINE に Webhook URL を登録する

### ウェブアプリとしてデプロイする

1. エディタの右上の「デプロイ」→「新しいデプロイ」を押す
2. 種類は「ウェブアプリ」。「次のユーザーとして実行」は「自分」、「アクセスできるユーザー」は「全員」（`src/appsscript.json` と同じ設定）
3. 「デプロイ」を押し、表示された「ウェブアプリの URL」（`https://script.google.com/macros/s/.../exec`）と「デプロイ ID」を控える

### LINE の設定

LINE Developers の「Messaging API 設定」で、次のようにします。

| 項目 | 設定 |
|---|---|
| Webhook URL | `ウェブアプリの URL?key=<WEBHOOK_KEY>` |
| Webhook の利用 | オン |
| Webhook の再送 | **オフ**（下の注意を参照） |
| 応答メッセージ（LINE 公式アカウントの管理画面） | オフ（オンだと AI の返信と二重になる） |

- 「検証」ボタンは「302 Found」のエラーになりますが、問題ありません。Apps Script のウェブアプリは必ず 302 を返すためで、処理は動いています
- LINE は 302 を配信の失敗とみなします。そのため、**「Webhook の再送」をオンにすると同じ返信が二重に届きます**。必ずオフにしてください
- Apps Script では LINE の署名ヘッダー（`x-line-signature`）を読めません。代わりに、URL の `?key=` と Webhook の `destination` で、本物の LINE からの通知かを確かめています

## 5. 動作を確かめる

| 確かめること | 方法 |
|---|---|
| 開発者へのエラーのメールが届く | `testNotifyDeveloper`（`Monitor.js`）を実行 |
| オーナー様へのお知らせのメールが届く | `testNotifyOwner`（`Notify.js`）を実行 |
| AI に渡す日付・祝日・お知らせが正しい | `testDateContext`（`Test.js`）を実行し、ログに2週間分の日付が出るか見る |
| 毎朝のチェックが通る | `dailyCheck`（`Monitor.js`）を実行し、ログに「すべて使えました」と出るか見る |
| AI の答え方 | `runTestQuestions`（`Test.js`）を実行。結果は記録のスプレッドシートの「テスト結果」タブに出て、ログに×の数が出る |
| LINE で返信が届く | テスト用の LINE 公式アカウントを友だちに追加し、質問を送る。答えられない質問（例：「明日の14時に予約できますか？」）を送ると、オーナー様へのメールも届く |

電話番号・メールアドレスの置き換えのテストは、手元で動かします。

```
node --test "tests/*.test.js"
```

## コードを変えたとき

```
clasp push --force
clasp update-deployment <デプロイ ID>
```

- `update-deployment` で、同じデプロイ（同じ Webhook URL）のまま中身が新しくなります
- エディタで「新しいデプロイ」を作り直すと URL が変わり、LINE の Webhook URL の登録もし直しになります
- コードを変えたあとは、`runTestQuestions` で AI の答え方が崩れていないかを確かめてください

### よく触る設定値（コードの中の定数）

| 定数 | ファイル | 中身 |
|---|---|---|
| `CLAUDE_MODEL_` | `Ai.js` | 使う AI のモデル。答えの質が足りなければ Sonnet に替える |
| `HISTORY_TURNS_` / `HISTORY_TTL_SEC_` | `Ai.js` | 直前の会話を何往復・何秒残すか（3往復・30分） |
| `PAUSE_HOURS_` | `Pause.js` | オーナー様に回したお客様に、AI が返信しない時間（24時間） |
| `DAILY_CHECK_HOUR_` | `Monitor.js` | 毎朝のチェックの時（7時台）。変えたら `setupDailyTrigger` を実行し直す |

## 本番に移すとき

本番は、すべて**お店名義のアカウント**で作ります。開発者がいなくなっても、お店が困らないようにするためです。手順は 1〜5 と同じで、違うのは次の点です。

1. お店の Google アカウントで `clasp login` し直し（`clasp logout` → `clasp login`）、新しいプロジェクトのスクリプト ID を `.clasp.json` に入れる
2. LINE は、お店の公式アカウントの Messaging API チャネルを使う
3. Anthropic の API キーは、お店名義のアカウントで発行する
4. 「お店のお知らせ」のカレンダーを、オーナー様の Google アカウントに「予定の変更」の権限で共有する（オーナー様のスマホのカレンダーアプリに出るようになる）
5. スプレッドシートの共有
   - 「お店の情報」：オーナー様（とスタッフさん）に編集の権限で共有する
   - 「記録」：オーナー様と、保守の契約中の開発者だけに共有する
   - どちらも「リンクを知っている全員」での共有はオンにしない
6. お店の Google アカウントの2段階認証をオンにする
7. 使い方マニュアルの、スプレッドシートのリンクと開発者の連絡先（今は架空のダミー）を本物に差し替える
8. LINE 公式アカウントのあいさつメッセージに、AI が答えることと、質問を記録して6か月後に消すことを書く

## 困ったとき

| こんなとき | 確かめること |
|---|---|
| エディタで「ファイルを開くことができません」と出る | 別の Google アカウントでブラウザにログインしている。https://script.google.com のマイプロジェクトから、プロジェクトを作ったアカウントで開く |
| clasp が「User has not enabled the Apps Script API」と出す | https://script.google.com/home/usersettings で Google Apps Script API をオンにする |
| 「スクリプト プロパティ ○○ が設定されていません」のエラー | 「3. 初回の関数を実行し、設定値を登録する」の抜けを確かめる |
| LINE で同じ返信が2回届く | LINE Developers の「Webhook の再送」がオフになっているか |
| LINE で返信が来ない | Webhook URL の `?key=` が `WEBHOOK_KEY` と同じか。エディタの「実行数」でエラーを見る |
| エラーの詳細を見たい | エディタの左の「実行数」。開発者へのエラーのメールにもリンクがある |
