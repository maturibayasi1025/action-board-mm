# GitHub Actions Secrets 設定ガイド

このドキュメントでは、GitHub Actions のワークフローを動作させるために必要な **Repository Secrets** の設定方法を説明します。

## 設定手順

1. GitHub リポジトリのページを開く
2. **Settings** → **Secrets and variables** → **Actions** を選択
3. **New repository secret** をクリック
4. 各 Secrets の **Name** と **Value** を入力して保存

> **ヒント**: 組織のリポジトリの場合、**Settings** へのアクセス権限が必要です。権限がない場合は組織の管理者に依頼してください。

## 必要な Secrets 一覧

### サーベイ生成ワークフロー（eNPS / Award）

`generate-enps-survey.yml` と `generate-award-survey.yml` で使用されます。
毎月25日 日本時間10:00 にスケジュール実行、または手動実行が可能です。

| Secret 名 | 説明 | 取得元 |
|-----------|------|--------|
| `SUPABASE_URL` | Supabase プロジェクトURL | [Supabase Dashboard](https://app.supabase.com) → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー | Supabase Dashboard → Settings → API → service_role secret |
| `BATCH_ADMIN_KEY` | バッチAPI認証キー | デプロイ環境（Vercel/Cloudflare等）の `BATCH_ADMIN_KEY` と同じ値 |
| `NEXT_PUBLIC_APP_ORIGIN` | デプロイ済みアプリのURL | 例: `https://your-app.vercel.app` または本番ドメイン |
| `SLACK_WEBHOOK_URL_ENPS` | eNPS サーベイ通知用 Webhook（任意） | 対象チャンネル用に [Incoming Webhooks](https://api.slack.com/messaging/webhooks) で作成 |
| `SLACK_WEBHOOK_URL_AWARD` | 表彰サーベイ通知用 Webhook（任意） | 対象チャンネル用に同上 |
| `SLACK_WEBHOOK_URL` | 上記が未設定のときのフォールバック / グッジョブ等の他通知 | Incoming Webhooks で作成 |

> **注意**: ワークフローはリポジトリ上で `npm run generate-enps-survey` / `generate-award-survey` を実行し、`npm run` のプロセスに上記 Secrets を渡します。Slack 通知はその実行時に送信されます。**デプロイ環境**（Vercel / Cloudflare 等）に管理画面の未回答リマインドやバッチ API 用の同じ変数を設定してください。`SLACK_WEBHOOK_URL_ENPS` / `SLACK_WEBHOOK_URL_AWARD` が未設定の場合は `SLACK_WEBHOOK_URL` にフォールバックします。

### バッジ計算ワークフロー（本番）

`calculate-badges-production.yml` で使用されます。
毎日 日本時間 0:05 にスケジュール実行、または手動実行が可能です。

| Secret 名 | 説明 | 取得元 |
|-----------|------|--------|
| `SUPABASE_URL` | Supabase プロジェクトURL（本番） | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー（本番） | 同上 |

### バッジ計算ワークフロー（ステージング）

`calculate-badges-staging.yml` で使用されます。
環境 `staging` の Secrets を使用します。

| Secret 名 | 説明 | 取得元 |
|-----------|------|--------|
| `STAGING_SUPABASE_URL` | Supabase URL（ステージング） | ステージング用 Supabase プロジェクト |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | サービスロールキー（ステージング） | 同上 |

> **注意**: ステージング環境の Secrets は **Environments** で `staging` を作成し、その環境に紐づけて設定することもできます。その場合、Repository レベルか Environment レベルのどちらかで一貫して設定してください。

## 設定後の確認

1. **手動実行でテスト**
   - **Actions** タブ → 対象ワークフローを選択 → **Run workflow** から手動実行
   - 例: `Generate Monthly eNPS Survey` または `Generate Monthly Award Survey`

2. **ログでエラー確認**
   - 実行後にログを開き、Secrets の未設定や認証エラーが出ていないか確認

3. **Slack 通知の確認**
   - サーベイ生成が成功した場合、設定した Slack チャンネルに通知が届くことを確認

## トラブルシューティング

### 403 Forbidden が返る
- `BATCH_ADMIN_KEY` がデプロイ環境の値と一致しているか確認
- `NEXT_PUBLIC_APP_ORIGIN` が正しい URL か確認（末尾の `/` は不要）

### Slack に通知が届かない
- **デプロイ環境**（Vercel / Cloudflare 等）に、サーベイ種別用の `SLACK_WEBHOOK_URL_ENPS` / `SLACK_WEBHOOK_URL_AWARD`、またはフォールバックの `SLACK_WEBHOOK_URL` が設定されているか確認
- GitHub Actions 側でも同じ名前の Secrets が必要（ワークフローが参照する変数と一致させる）
- Webhook URL が `https://hooks.slack.com/services/...` 形式か確認

### ステージング用 Secrets が反映されない
- `staging` 環境が **Settings** → **Environments** で作成されているか確認
- Environment に紐づけた Secrets は、その環境がジョブで指定されている場合にのみ使用されます
