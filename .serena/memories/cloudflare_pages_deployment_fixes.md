# Cloudflare Pages Deployment Fixes

## 問題解決 (最終更新: 2025-09-17)

### Issue 9: デプロイ後にHTMLコンテンツではなくバイナリデータが表示される ✅ RESOLVED

**問題**: Cloudflare Pagesデプロイ後、アプリケーションの代わりに画像ファイルやバイナリデータが表示される

**根本原因**: 
1. `@cloudflare/next-on-pages`パッケージが不足
2. `build:cloudflare`スクリプトに`@cloudflare/next-on-pages`の実行が含まれていない
3. Cloudflare Pagesダッシュボードの設定が間違っている可能性

**解決策**:

#### 1. 必要パッケージのインストール
```bash
npm install --save-dev @cloudflare/next-on-pages
```

#### 2. package.jsonの修正
```json
{
  "scripts": {
    "build:cloudflare": "CF_PAGES=true NODE_ENV=production DISABLE_SENTRY=true NEXT_PUBLIC_DISABLE_SENTRY=true npx next build && npx @cloudflare/next-on-pages"
  }
}
```

#### 3. wrangler.tomlの修正
```toml
# Cloudflare Pages用設定
name = "action-board-mm"
compatibility_date = "2025-08-28"  
compatibility_flags = ["nodejs_compat"]

# 自動検出によるビルド設定
[build]
command = "npm run build:cloudflare"

# Edge Runtime対応
[env.production]
NODE_ENV = "production"
CF_PAGES = "true"

# 環境変数（Public環境変数のみ）
[vars]
NEXT_PUBLIC_SUPABASE_URL = "https://plzqywjvkteyxsdqmred.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
NEXT_PUBLIC_SITE_URL = "https://mm-actionboard.jp"
NEXT_PUBLIC_APP_ORIGIN = "https://mm-actionboard.jp"
CF_PAGES = "true"
```

## Cloudflare Pagesダッシュボード設定（重要）

### ビルド設定

**Framework preset**: None (カスタム設定)

**Build command**: 
```bash
npm run build:cloudflare
```

**Build output directory**:
```
.vercel/output/static
```

**Root directory**: 
```
/
```

### 環境変数設定

**Production環境に必須の環境変数**:

| 環境変数名 | 値 | 説明 |
|------------|-----|------|
| `CF_PAGES` | `true` | Cloudflare Pagesビルドモードを有効化 |
| `NODE_ENV` | `production` | 本番環境設定 |
| `DISABLE_SENTRY` | `true` | Sentryを無効化（ビルド時） |
| `NEXT_PUBLIC_DISABLE_SENTRY` | `true` | Sentryを無効化（クライアント側） |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | SupabaseプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase匿名キー |

**オプション環境変数**:
- `NEXT_PUBLIC_GA_ID` - Google Analytics
- `NEXT_PUBLIC_LINE_CLIENT_ID` - LINE Login
- `LINE_CLIENT_SECRET` - LINE Login シークレット
- `BATCH_ADMIN_KEY` - 管理者API キー

### デプロイメント設定手順

1. **Cloudflare Pagesダッシュボードにアクセス**
2. **新しいプロジェクトを作成** またはプロジェクト設定を開く
3. **Settings > Build & deployments** に移動
4. **Build configuration** を以下のように設定:
   - Framework preset: `None`
   - Build command: `npm run build:cloudflare`
   - Build output directory: `.vercel/output/static`
   - Root directory: `/`

5. **Settings > Environment variables** に移動
6. **Production** タブで上記の必須環境変数をすべて追加

7. **デプロイを再実行**

### トラブルシューティング

#### 問題: ホームページで画像/バイナリデータが表示される
**原因**: Cloudflare Pagesの設定が間違っている
**解決策**: 
- Build output directoryが`.vercel/output/static`に設定されているか確認
- Build commandが`npm run build:cloudflare`に設定されているか確認
- 必須環境変数がすべて設定されているか確認

#### 問題: ビルドが失敗する
**原因**: 環境変数不足またはパッケージ不足
**解決策**:
- `CF_PAGES=true`が設定されているか確認
- `@cloudflare/next-on-pages`がdevDependenciesにインストールされているか確認
- TypeScript設定で`tsconfig.cloudflare.json`が使用されているか確認

#### 問題: Runtime errorが発生する
**原因**: Supabase環境変数不足
**解決策**:
- `NEXT_PUBLIC_SUPABASE_URL`と`NEXT_PUBLIC_SUPABASE_ANON_KEY`が設定されているか確認
- 値が正しいSupabaseプロジェクトのものか確認

### ビルド成功の確認方法

正常にビルドされた場合、以下の構造が`.vercel/output/static/`に生成される：

```
.vercel/output/static/
├── _worker.js/
│   ├── index.js (メインWorkerファイル)
│   └── __next-on-pages-dist__/ (Functions)
├── _routes.json (ルーティング設定)
├── _headers (ヘッダー設定)
├── favicon.ico
├── 500.html
└── _next/ (静的アセット)
```

### 最終的な設定ファイル

#### package.json (重要な部分)
```json
{
  "scripts": {
    "build:cloudflare": "CF_PAGES=true NODE_ENV=production DISABLE_SENTRY=true NEXT_PUBLIC_DISABLE_SENTRY=true npx next build && npx @cloudflare/next-on-pages"
  },
  "devDependencies": {
    "@cloudflare/next-on-pages": "^1.13.16"
  }
}
```

#### next.config.ts
```typescript
const nextConfig: NextConfig = {
  output: process.env.STANDALONE_BUILD ? "standalone" : undefined,
  typescript: process.env.CF_PAGES === "true" ? {
    tsconfigPath: "./tsconfig.cloudflare.json"
  } : undefined,
  // ... 他の設定
};
```

## 重要な注意点

1. **ビルド出力ディレクトリ**: 必ず`.vercel/output/static`を指定
2. **環境変数**: 全ての必須環境変数を設定
3. **ビルドコマンド**: `npm run build:cloudflare`を使用
4. **Framework preset**: `None`に設定（Nextjs presetは使わない）

これらの設定を正しく行うことで、Next.js 15アプリケーションがCloudflare Pagesで正常に動作します。