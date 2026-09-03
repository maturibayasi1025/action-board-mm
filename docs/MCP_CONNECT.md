# Action Board MCP のつなぎ方

他の AI（Cursor / ChatGPT など）から、Action Board の公開データと、許可された人だけがサーベイ回答を読むための入口です。読み取り専用です。DB の接続情報は渡しません。

サーバー URL:

```
https://mm-actionboard.jp/api/mcp
```

## 事前に必要なもの

- `@maisonmarc.com` の Google Workspace アカウント
- 運用者に MCP 許可リストへ入れてもらうこと

個人 Gmail では入れません。許可リストに無い会社メールも入れません。

個別回答（点数・コメント）まで使う人は、許可リストを JSON で `survey_raw` 付きにしてもらってください。カンマ区切りの登録だと公開データだけです。

## 取れるもの

| 内容 | メモ |
|------|------|
| ミッション、ランキング、公開プロフィール、承認済みグッジョブ | 許可されれば使える |
| eNPS の集計、表彰の指名件数 | 集計用スコープがある人 |
| Slack ID | 専用スコープ。Google ログイン必須 |
| eNPS / 表彰の個別回答（点数・コメント） | 専用スコープ。Google ログイン必須 |
| 月次 CSV（1人1行） | ツール名 `export_enps_responses_csv` / `export_award_responses_csv`。`year_month`（例: `2026-08`）か `survey_id` |

## 取れないもの

- メール、生年月日、HubSpot ID
- 任意 SQL、書き込み
- 全期間の一括ダンプ（月単位なら可）

個別回答を他 AI に渡すと、その会話ログに自由記述が残ります。

---

## Cursor（推奨）

Plus 制限はなく、いちばん確実です。

### 方法 A: Connect（OAuth）

Cursor の MCP 設定に URL だけ置く。

```json
{
  "mcpServers": {
    "action-board": {
      "url": "https://mm-actionboard.jp/api/mcp"
    }
  }
}
```

Connect を押すとブラウザが開くので、会社の Google でログインする。

### 方法 B: 接続ページのトークンを貼る

1. [MCP 接続ページ](https://mm-actionboard.jp/mcp/connect) を開く
2. 会社 Google でログインする
3. 表示されたトークンを貼る

```json
{
  "mcpServers": {
    "action-board": {
      "url": "https://mm-actionboard.jp/api/mcp",
      "headers": {
        "Authorization": "Bearer <接続ページのトークン>"
      }
    }
  }
}
```

トークンの有効期限は 8 時間です。切れたら接続ページで再ログインするか、Cursor で再 Connect します。

---

## ChatGPT

Custom GPT の Actions ではつながりません。**カスタム MCP（Developer Mode）** です。

**ChatGPT Plus では使えません。** Pro / Business / Enterprise / Edu が必要です。Plus の人は Cursor を使ってください。

1. Settings → Apps（または Security and login）→ Advanced settings で Developer mode をオンにする
2. プラグイン / MCP の管理を開き、カスタム MCP を追加する
3. タイプは **STDIO ではなく「ストリーミング可能な HTTP」**
4. URL に `https://mm-actionboard.jp/api/mcp` を入れる
5. 名前は例えば `action_board`
6. 起動用コマンド・引数・環境変数は使わない
7. 接続するとブラウザが開くので、会社 Google でログインする
8. `Authentication complete. You may close this window.` が出たらウィンドウを閉じる

`http://localhost:xxxxx/callback` は ChatGPT 側の戻り先です。失敗時は `error=...` が付きます。成功時はコマンド欄ではありません。

### ON かどうかの見方

チャットの「＋」メニュー（写真、ウェブ検索、Google Drive など）には **出ません。** そこは公式プラグインの一覧です。

ON は MCP 管理画面で見ます。`action_board` の右端トグルが青なら有効です。「認証する」ボタンは成功後も残ることがあります。再ログイン用なので、消えないこと自体は失敗ではありません。

新しいチャットを開き、トグルが青のまま直接聞いてください。＋から選ぶ必要はありません。

---

## 聞いてみるとよいこと

- 「Action Board のミッションを 3 件出して」
- 「今月の eNPS サーベイ一覧を出して」
- 「2026-08 の eNPS 回答を CSV で出して」（`survey_raw` がある人）

CSV は 1人1行で、Excel や Google スプレッドシートに貼れます。

---

## うまくいかないとき

| 症状 | 確認 |
|------|------|
| 会社 Google なのに入れない | 許可リストにそのメールがあるか。運用者に確認 |
| ドメインエラー | `@maisonmarc.com` の Workspace か。個人 Gmail は不可 |
| ChatGPT の「＋」に action_board が無い | 仕様です。MCP 管理のトグルを見る |
| Plus でカスタム MCP が増やせない | Plus は非対応。Cursor か上位プラン |
| 認証画面のあと「認証する」が残る | 成功後も残ることがある。新しいチャットで質問して確認 |
| 点数・コメントが取れない | 許可リストがカンマ区切りだと `public` のみ。JSON で `survey_raw` が必要 |
| トークン切れ（Cursor） | 8 時間。接続ページか再 Connect |
