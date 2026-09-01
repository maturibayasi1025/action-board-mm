# Action Board MCP 接続手順

読み取り専用のリモート MCP です。公開データに加え、Google 許可リストでスコープを付けた人だけが集計・Slack ID・個別回答を取れます。

URL: `https://mm-actionboard.jp/api/mcp`

## 推奨: Google Workspace で接続（Phase 1.5）

1. 運用者が Cloudflare に次を設定する（Encrypt）
   - `MCP_JWT_SECRET`
   - `MCP_GOOGLE_CLIENT_ID` / `MCP_GOOGLE_CLIENT_SECRET`
   - `MCP_ALLOWED_GOOGLE_DOMAIN=maisonmarc.com`
   - `MCP_ALLOWED_GOOGLE_EMAILS`（空だと誰も入れない。カンマ区切りは `public` のみ。制限データは JSON）

```json
[
  {
    "email": "owner@maisonmarc.com",
    "scopes": ["public", "survey_agg", "slack_directory", "survey_raw"]
  }
]
```
2. Google Cloud の OAuth クライアント（ウェブ）のリダイレクト URI に  
   `https://mm-actionboard.jp/api/mcp/oauth/google/callback` を登録する
3. ブラウザで [MCP 接続ページ](https://mm-actionboard.jp/mcp/connect) を開き、会社の Google アカウントでログインする
4. 表示されたトークンを Cursor に貼る

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

Cursor の Connect（OAuth）にも対応しています。その場合は URL だけ置けます。

```json
{
  "mcpServers": {
    "action-board": {
      "url": "https://mm-actionboard.jp/api/mcp"
    }
  }
}
```

Connect を押すとブラウザが開き、`@maisonmarc.com` でログインします。許可リスト外と個人 Gmail は入れません。

アクセストークンの有効期限は 8 時間です。OAuth（Cursor Connect / ChatGPT）では refresh token（30日）で更新します。接続ページの手貼りトークンは refresh しないので、切れたら再ログインしてください。

## ChatGPT（Developer mode / Apps）

Cursor のように `mcp.json` へ Bearer を書く方式は使えません。ChatGPT のコネクタに URL を登録し、OAuth でつなぎます。

1. ChatGPT Business / Enterprise / Edu（Pro は Developer mode の読み取りまで）で Developer mode をオンにする
2. Settings → Apps → Create（または Workspace settings → Apps → Create）
3. MCP サーバー URL に `https://mm-actionboard.jp/api/mcp` を入れる
4. 認証は OAuth。Scan Tools のあと、会社の Google でログインする
5. 新しいチャットのツール一覧からそのアプリを選ぶ

ChatGPT の OAuth コールバック（`https://chatgpt.com/connector_platform_oauth_redirect` など）を許可しています。許可リスト外と個人 Gmail は入れません。

個別回答を ChatGPT に渡すと会話ログに自由記述が残ります。`survey_raw` は必要な人だけに付けてください。

## 暫定: 配布キー（Phase 1）

Google 設定前の接続確認用です。キーはコピーで広がるので、本番の本人確認にはしません。

```json
{
  "mcpServers": {
    "action-board": {
      "url": "https://mm-actionboard.jp/api/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_API_KEYS の secret>"
      }
    }
  }
}
```

## スコープ

| スコープ | 取れるもの | 条件 |
|----------|------------|------|
| `public` | ミッション、ランキング、公開プロフィール、承認済みグッジョブ | API キーまたは Google |
| `survey_agg` | eNPS サーベイ定義、月次スナップショット、表彰指名件数 | スコープがあれば可 |
| `slack_directory` | `user_id` + 公開名 + Slack ID | **Google ログイン必須**。API キーでは不可 |
| `survey_raw` | eNPS / 表彰の個別回答（`survey_id` 必須） | **Google ログイン必須**。API キーでは不可 |

個別回答を他AIに渡すと、会話ログやプロバイダ側に自由記述が残ります。

## この接続で取れないもの

- メール、生年月日、HubSpot ID
- 任意 SQL
- 書き込み（投稿、いいね、回答、`replace_*_responses`）
- `enps_report_ai_summaries.payload`
- Slack ID（`slack_directory` が無い、または API キーのみのとき）
- 個別回答（`survey_raw` が無い、または API キーのみのとき）

## 認証エラー

| 症状 | 確認 |
|------|------|
| 401 Unauthorized | Bearer が付いているか。トークン期限切れなら再ログイン |
| 接続ページでドメインエラー | `@maisonmarc.com` の Workspace アカウントか |
| 許可リストにない | `MCP_ALLOWED_GOOGLE_EMAILS` にそのメールがあるか |
| 405 | POST 以外で叩いている |
