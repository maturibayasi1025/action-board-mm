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
SLACK_WEBHOOK_URL            # Slack通知用WebhookURL
BATCH_ADMIN_KEY             # バッチ処理認証用キー
HUBSPOT_API_KEY             # HubSpot APIキー
HUBSPOT_CONTACT_LIST_ID     # HubSpotコンタクトリストID
```

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

Cloudflareダッシュボードでのビルド設定：

```
ビルドコマンド: npm run build:cloudflare && npm run pages:build
ビルド出力ディレクトリ: .vercel/output/static
```

## 5. トラブルシューティング

### 環境変数が反映されない場合
1. デプロイメントを再実行
2. キャッシュをクリア
3. `wrangler.toml`の変更をコミット・プッシュ

### エラーが発生する場合
1. すべての必須環境変数が設定されているか確認
2. シークレット環境変数が暗号化されているか確認
3. 環境変数の値に特殊文字が含まれていないか確認

## 注意事項

- `NEXT_PUBLIC_`で始まる環境変数はクライアントサイドで公開されます
- APIキーやシークレットは必ずCloudflareダッシュボードで暗号化して設定してください
- 環境変数の値を変更した場合は、再デプロイが必要です
