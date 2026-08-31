# Action Board MCP 接続手順

読み取り専用のリモート MCP です。公開データ（ミッション、ランキング、公開プロフィール、承認済みグッジョブ）だけが取れます。

URL: `https://mm-actionboard.jp/api/mcp`

## 推奨: Google Workspace で接続（Phase 1.5）

1. 運用者が Cloudflare に次を設定する（Encrypt）
   - `MCP_JWT_SECRET`
   - `MCP_GOOGLE_CLIENT_ID` / `MCP_GOOGLE_CLIENT_SECRET`
   - `MCP_ALLOWED_GOOGLE_DOMAIN=maisonmarc.com`
   - `MCP_ALLOWED_GOOGLE_EMAILS`（例: `owner@maisonmarc.com`。空だと誰も入れない）
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

トークンの有効期限は 8 時間です。切れたら接続ページで再ログインするか、Cursor で再 Connect します。

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

## この接続で取れないもの

- メール、生年月日、HubSpot ID、Slack ID
- eNPS / 表彰の個別回答
- 任意 SQL
- 書き込み（投稿、いいね、回答）

## 認証エラー

| 症状 | 確認 |
|------|------|
| 401 Unauthorized | Bearer が付いているか。トークン期限切れなら再ログイン |
| 接続ページでドメインエラー | `@maisonmarc.com` の Workspace アカウントか |
| 許可リストにない | `MCP_ALLOWED_GOOGLE_EMAILS` にそのメールがあるか |
| 405 | POST 以外で叩いている |
