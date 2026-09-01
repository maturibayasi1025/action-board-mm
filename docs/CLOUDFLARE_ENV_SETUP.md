# Cloudflare Pages 環境変数設定ガイド

## 概要
Cloudflare Pagesでは、環境変数を2つの方法で管理します：
1. **wrangler.toml** - Public環境変数（ブラウザで使用可能）
2. **Cloudflareダッシュボード** - シークレット環境変数（サーバーサイドのみ）

## 1. wrangler.tomlで管理する環境変数

以下の環境変数は`wrangler.toml`で設定済みです。実際の値に置き換えてください：

```toml
[vars]
NEXT_PUBLIC_SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL"
NEXT_PUBLIC_SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"
NEXT_PUBLIC_SITE_URL = "https://your-cloudflare-pages-domain.pages.dev"
NEXT_PUBLIC_APP_ORIGIN = "https://your-cloudflare-pages-domain.pages.dev"
NEXT_PUBLIC_LINE_CLIENT_ID = "YOUR_LINE_CLIENT_ID"
NEXT_PUBLIC_GA_ID = "YOUR_GOOGLE_ANALYTICS_ID"
```

`[env.production]` を追加すると、Pages では `vars` が継承されません。本番用に別値を置く場合は、必要な公開変数をすべて `[env.production.vars]` に再掲してください。空の `[env.production]` や `NODE_ENV` だけのブロックは置かないでください（本番 SSR が全滅します）。

`NODE_ENV` も `[vars]` に置かないでください。Cloudflare Pages は `[vars]` をビルド環境にも注入するため、`npm ci` が devDependencies を省略し、`next build` の型チェックが失敗します。`NODE_ENV=production` は `npm run build:pages` 側で指定します。

### 値の取得方法

#### Supabase
1. [Supabaseダッシュボード](https://supabase.com/dashboard)にログイン
2. プロジェクトを選択
3. Settings → API
4. `URL`と`anon public`キーをコピー

#### LINE Login
1. [LINE Developers Console](https://developers.line.biz/console/)にログイン
2. プロバイダーとチャンネルを選択
3. Basic settings → Channel ID

#### Google Analytics
1. [Google Analytics](https://analytics.google.com/)にログイン
2. 管理 → データストリーム
3. 測定IDをコピー（G-XXXXXXXXXXの形式）

## 2. Cloudflareダッシュボードで設定する環境変数（シークレット）

以下の環境変数は、Cloudflareダッシュボードで設定してください：

### 必須の環境変数
```
SUPABASE_SERVICE_ROLE_KEY    # Supabase service role key
MAILGUN_API_KEY              # Mailgun APIキー
MAILGUN_DOMAIN               # Mailgunドメイン（例：mg.yourdomain.com）
LINE_CLIENT_SECRET           # LINE Login Channel Secret
```

### オプションの環境変数
```
MAILGUN_API_BASE_URL         # Mailgun APIベースURL（デフォルト：https://api.mailgun.net）
SLACK_WEBHOOK_URL            # Slack通知用WebhookURL（グッジョブ等）
SLACK_WEBHOOK_URL_ENPS       # eNPSサーベイ通知（対象チャンネル用。未設定時は通知しない）
SLACK_WEBHOOK_URL_AWARD      # 表彰サーベイ通知（対象チャンネル用。未設定時は通知しない）
BATCH_ADMIN_KEY             # バッチ処理認証用キー
MCP_API_KEYS                # MCP 読み取りキー（JSON配列。id/secret/scopes/label）。Encrypt すること
MCP_JWT_SECRET              # MCP 用 JWT 署名。Google ログインに必須。Encrypt すること
MCP_GOOGLE_CLIENT_ID        # MCP 専用 Google OAuth クライアント ID
MCP_GOOGLE_CLIENT_SECRET    # MCP 専用 Google OAuth クライアントシークレット。Encrypt すること
MCP_ALLOWED_GOOGLE_DOMAIN   # 既定: maisonmarc.com
MCP_ALLOWED_GOOGLE_EMAILS   # 許可メール（カンマ区切りは public のみ。制限データは JSON で scopes）。空なら誰も入れない
                            # 例: [{"email":"owner@maisonmarc.com","scopes":["public","survey_agg","slack_directory","survey_raw"]}]
HUBSPOT_API_KEY             # HubSpot APIキー
HUBSPOT_CONTACT_LIST_ID     # HubSpotコンタクトリストID
```

> **注意**: eNPS レポートの自由記述 AI 分析用 `ENPS_REPORT_AI_API_KEY` は **Cloudflare（Preview / Production）には設定しません**。生成は GitHub Actions の `Build Monthly eNPS Report` ワークフローだけで行い、キーは GitHub の Repository Secret に置きます。詳細は [`.github/SECRETS_SETUP.md`](../.github/SECRETS_SETUP.md) を参照してください。

### 設定方法
1. [Cloudflareダッシュボード](https://dash.cloudflare.com/)にログイン
2. Pages → プロジェクトを選択
3. Settings → Environment variables
4. Add variable で追加
5. 「Encrypt」をオンにして暗号化

## 3. メトリクス用フォールバック値（オプション）

アプリケーションのメトリクス表示用のフォールバック値：

```
FALLBACK_SUPPORTER_COUNT = "0"
FALLBACK_SUPPORTER_INCREASE = "0"
FALLBACK_DONATION_AMOUNT = "0"
FALLBACK_DONATION_INCREASE = "0"
FALLBACK_ACHIEVEMENT_COUNT = "0"
FALLBACK_TODAY_ACHIEVEMENT_COUNT = "0"
FALLBACK_UPDATE_DATE = "2025.01.01 00:00"
```

## 4. ビルドコマンド設定

Cloudflareダッシュボードでのビルド設定（**`@cloudflare/next-on-pages` 利用時**）：

```
ビルドコマンド: npm run build:pages:cloudflare
ビルド出力ディレクトリ: .vercel/output/static
```

`build:pages:cloudflare` は `build:pages` と同じで、`clean` → `next build` → `next-on-pages` まで一括実行します。

手書きする場合の例（同等）：

```
npx next build && npx @cloudflare/next-on-pages
```

（リポジトリでは `npm run clean` や `NODE_ENV=production` も入るため、**`npm run build:pages`** の利用を推奨します。）

### Edge Runtime について（重要）

`@cloudflare/next-on-pages` は **非静的ルートに `export const runtime = 'edge'` が必要**です。`remove-edge-runtime.js` で Edge 指定を消すビルド（`build:pages:no-edge` など）を使うと、ビルドが次のように失敗します：

- `Please make sure that all your non-static routes export ... runtime = 'edge'`

そのため **Cloudflare Pages の本番デプロイでは `remove-edge-runtime.js` を実行しない**でください。

### Worker サイズ（無料枠 3 MiB など）

Edge を外して小さくする方法は **next-on-pages では使えません**。代替として次を検討できます。

- **`npm run build:pages:no-sentry`** … Sentry をビルドから外し、バンドルが多少小さくなる場合がある（Edge は維持）
- **有料プラン** … Worker 上限が大きくなる（例: 10 MiB）
- **依存関係の整理** … サーバー側に載るライブラリの見直し

`build:pages:no-edge` は next-on-pages 向けではなく、別用途の検証用として扱ってください。

## 5. トラブルシューティング

### 環境変数が反映されない場合
1. デプロイメントを再実行
2. キャッシュをクリア
3. `wrangler.toml`の変更をコミット・プッシュ

### エラーが発生する場合
1. すべての必須環境変数が設定されているか確認
2. シークレット環境変数が暗号化されているか確認
3. 環境変数の値に特殊文字が含まれていないか確認

### Worker のサイズ制限（3 MiB / 10 MiB）
- 無料枠で **3 MiB** を超えるとデプロイに失敗します。Edge は削れないため、**`build:pages:no-sentry`** や依存の見直し、必要に応じて **有料プラン**を検討してください。

### `runtime = 'edge'` が無いとビルドが落ちる
- `build:pages:no-edge` や `remove-edge-runtime.js` を使っている場合はやめ、**`npm run build:pages`**（または `build:pages:cloudflare`）に戻してください。

## 注意事項

- `NEXT_PUBLIC_`で始まる環境変数はクライアントサイドで公開されます
- APIキーやシークレットは必ずCloudflareダッシュボードで暗号化して設定してください
- 環境変数の値を変更した場合は、再デプロイが必要です
