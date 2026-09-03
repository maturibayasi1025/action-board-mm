# Action Board MCP 接続手順（運用者向け）

メンバーが Cursor / ChatGPT からつなぐ手順だけ見る場合は [MCP_CONNECT.md](./MCP_CONNECT.md) を使う。この文書はサーバー側の Google ログイン設定です。

読み取り専用のリモート MCP です。公開データに加え、Google 許可リストでスコープを付けた人だけが集計・Slack ID・個別回答を取れます。

URL: `https://mm-actionboard.jp/api/mcp`

## 推奨: Google Workspace で接続（Phase 1.5）

1. 運用者が Cloudflare Pages（Production）に次を設定する（Encrypt して再デプロイ）

| 変数 | 取得方法 |
|------|----------|
| `MCP_JWT_SECRET` | Google から取る値ではない。自分で作る署名鍵。ターミナルで `openssl rand -base64 48` を実行し、出力をそのまま入れる |
| `MCP_GOOGLE_CLIENT_ID` | 下記「Google OAuth クライアント」のクライアント ID |
| `MCP_GOOGLE_CLIENT_SECRET` | 同じ画面のクライアント シークレット。Encrypt 必須 |
| `MCP_ALLOWED_GOOGLE_DOMAIN` | 固定で `maisonmarc.com`。Google Cloud から取得しない |
| `MCP_ALLOWED_GOOGLE_EMAILS` | 入れる人の会社メールを運用者が書く。空だと誰も入れない。カンマ区切りは `public` のみ。制限データは JSON |

```json
[
  {
    "email": "owner@maisonmarc.com",
    "scopes": ["public", "survey_agg", "slack_directory", "survey_raw"]
  }
]
```

### Google OAuth クライアント（`MCP_GOOGLE_CLIENT_ID` / `SECRET`）

1. [Google Cloud Console](https://console.cloud.google.com/) に会社アカウントで入る
2. Action Board 用のプロジェクトを選ぶ（無ければ作成）
3. **API とサービス → OAuth 同意画面**
   - User Type は Workspace なら **内部**
   - アプリ名は例えば `Action Board MCP`
   - スコープは `openid` と `email` で足りる
4. **API とサービス → 認証情報 → 認証情報を作成 → OAuth クライアント ID**
   - アプリケーションの種類: **ウェブ アプリケーション**
   - 承認済みのリダイレクト URI に次を追加する（`localhost` は入れない）

```
https://mm-actionboard.jp/api/mcp/oauth/google/callback
```

5. 作成後に出る **クライアント ID** が `MCP_GOOGLE_CLIENT_ID`、**クライアント シークレット** が `MCP_GOOGLE_CLIENT_SECRET`

ChatGPT / Cursor の callback（`http://localhost:.../callback`）はクライアント側の戻り先なので、Google Cloud には登録しない。

2. Cloudflare に入れたあと Production を再デプロイする
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

トークンの有効期限は 8 時間です。切れたら接続ページで再ログインするか、Cursor で再 Connect します。

## ChatGPT

Custom GPT（Actions / OpenAPI）ではなく、**ChatGPT のカスタムコネクタ（Developer Mode）** から同じリモート MCP につなぎます。**Plus では使えません。** Pro / Business / Enterprise / Edu が必要です。画面操作は [MCP_CONNECT.md](./MCP_CONNECT.md) を参照。

1. ChatGPT で Settings → Apps（または Security and login）→ Advanced settings から **Developer mode** をオンにする
2. Settings → Connectors → Create
3. サーバー URL に次を入れる

```
https://mm-actionboard.jp/api/mcp
```

4. 接続するとブラウザが開き、`@maisonmarc.com` の Google でログインする
5. 新しいチャットでコネクタを有効にする

ChatGPT は Cursor のようにトークンを手貼りできません。OAuth でログインする必要があります。許可リストに `survey_raw` が付いていれば、月次 CSV（`export_enps_responses_csv`）も同じツールで取れます。

個別回答は ChatGPT の会話ログに残ります。

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
| `survey_raw` | eNPS / 表彰の個別回答（`survey_id` 必須）。月次 CSV 一括は `year_month` 可 | **Google ログイン必須**。API キーでは不可 |

個別回答を他AIに渡すと、会話ログやプロバイダ側に自由記述が残ります。

月次の点数・コメントをシートで使う場合は `export_enps_responses_csv` / `export_award_responses_csv` です。`year_month`（例: `2026-08`）か `survey_id` を指定すると、1人1行の CSV が返ります。Excel や Google スプレッドシートに貼れます。全期間の一括ダンプはありません。

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
| `error=not_configured`（戻り URL が `localhost` でも可） | Cloudflare に `MCP_JWT_SECRET` / `MCP_GOOGLE_CLIENT_ID` / `MCP_GOOGLE_CLIENT_SECRET` が無い。上の取得方法を見て Production に入れ、再デプロイする |
| 接続ページでドメインエラー | `@maisonmarc.com` の Workspace アカウントか |
| 許可リストにない | `MCP_ALLOWED_GOOGLE_EMAILS` にそのメールがあるか |
| 405 | POST 以外で叩いている |
