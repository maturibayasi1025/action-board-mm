# Action Board MCP 接続手順（Phase 1）

読み取り専用のリモート MCP です。公開データ（ミッション、ランキング、公開プロフィール、承認済みグッジョブ）だけが取れます。

URL: `https://mm-actionboard.jp/api/mcp`  
（プレビュー環境ではその Pages のオリジン + `/api/mcp`）

## 前提

1. 運用者が `MCP_API_KEYS` を Cloudflare のシークレットに設定している
2. 自分用のキー（`secret`）を口頭やパスワードマネージャで受け取っている
3. キーはチャット・Git・スクリーンショットに置かない

Phase 1 のキーは接続確認用です。Google Workspace ログインは次の段階で必須にする予定です。

## Cursor

`~/.cursor/mcp.json`（またはプロジェクトの `.cursor/mcp.json`）:

```json
{
  "mcpServers": {
    "action-board": {
      "url": "https://mm-actionboard.jp/api/mcp",
      "headers": {
        "Authorization": "Bearer <受け取ったキー>"
      }
    }
  }
}
```

Cursor を再起動し、Tools & MCP で `action-board` が繋がっていることを確認する。

試しに「公式ミッションを3件教えて」「今日の XP ランキング上位を教えて」と聞く。`list_missions` / `get_xp_ranking` が呼ばれるはずです。

## このキーで取れないもの

- メール、生年月日、HubSpot ID、Slack ID
- eNPS / 表彰の個別回答
- 任意 SQL
- 書き込み（投稿、いいね、回答）

## 認証エラー

| 症状 | 確認 |
|------|------|
| 401 Unauthorized | `Authorization: Bearer ...` が付いているか。キーが `MCP_API_KEYS` の `secret` と一致するか |
| ツールが一覧に出ない | キーの `scopes` に `public` があるか |
| 405 | POST 以外で叩いている。ブラウザで GET しただけでは使えない |
