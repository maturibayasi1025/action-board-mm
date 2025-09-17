# Cloudflare Pages Deployment Fixes

## 最終解決策 (2025-09-18)

### 問題: Storybookファイルによるビルドエラー

**エラー内容:**
```
Cannot find module '@storybook/react' or its corresponding type declarations
```

**根本原因:**
- Cloudflare Pagesビルド環境でdevDependenciesがインストールされない
- Storybookファイルがビルド時に含まれてTypeScriptエラーが発生

### 解決方法（正常動作時の設定を維持したまま）

#### 1. tsconfig.cloudflare.json を作成
Storybookファイルを除外する専用のTypeScript設定：

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    // tsconfig.jsonと同じ設定
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "stories/**/*",
    "**/*.stories.*",
    ".storybook/**/*",
    "vitest.config.ts"
  ]
}
```

#### 2. next.config.ts (最小限の変更)
正常動作時のコミット`fdd2e92`の設定を維持し、TypeScript設定の切り替えのみ追加：

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.STANDALONE_BUILD ? "standalone" : undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
  images: {
    unoptimized: true,
  },
  // Cloudflare Pages環境でのみStorybookファイルを除外
  typescript: process.env.CF_PAGES === "true"
    ? {
        tsconfigPath: "./tsconfig.cloudflare.json",
      }
    : undefined,
};

export default nextConfig;
```

#### 3. package.json
build:cloudflareスクリプトにCF_PAGES=trueを追加：

```json
"build:cloudflare": "npm run clean && CF_PAGES=true NODE_ENV=production npx next build && npm run clean-cache"
```

#### 4. wrangler.toml (正常動作時と同じ)
```toml
name = "action-board-mm"
compatibility_date = "2025-08-28"  
compatibility_flags = ["nodejs_compat"]

[build]
command = "npm run build"

[env.production]
NODE_ENV = "production"
CF_PAGES = "true"

[vars]
NEXT_PUBLIC_SUPABASE_URL = "..."
NEXT_PUBLIC_SUPABASE_ANON_KEY = "..."
NEXT_PUBLIC_SITE_URL = "https://mm-actionboard.jp"
NEXT_PUBLIC_APP_ORIGIN = "https://mm-actionboard.jp"
CF_PAGES = "true"

[build.environment]
NODE_ENV = "production"
```

### Cloudflare Pagesダッシュボード設定

**ビルド設定:**
- Build command: `npm run build:cloudflare && npm run pages:build`
- Build output directory: `.vercel/output/static`
- Root directory: `/`

**環境変数（正常動作時と同じ）:**
- `NEXT_PUBLIC_APP_ORIGIN`: `https://mm-actionboard.jp`
- `NEXT_PUBLIC_SITE_URL`: `https://mm-actionboard.jp`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (提供されたキー)
- `NEXT_PUBLIC_SUPABASE_URL`: `https://plzqywjvkteyxsdqmred.supabase.co`
- `SLACK_WEBHOOK_URL`: (暗号化された値)
- `SUPABASE_SERVICE_ROLE_KEY`: (暗号化された値)

### 重要なポイント

1. **正常動作時の設定を維持**
   - 複雑なWebpack設定やPrisma関連の設定は削除
   - シンプルなnext.config.tsを維持
   
2. **最小限の変更で問題解決**
   - TypeScript設定の切り替えのみ追加
   - CF_PAGES環境変数を使用してtsconfig.cloudflare.jsonを適用
   
3. **Storybookエラーの回避**
   - stories/, .storybook/, *.stories.* ファイルをTypeScriptチェックから除外
   - ビルド時のみこの設定を使用

### 動作確認

✅ **ビルド成功確認:**
- `CF_PAGES=true NODE_ENV=production npx next build` が成功
- Storybookエラーが発生しない
- "Using tsconfig file: ./tsconfig.cloudflare.json" というメッセージが表示

この設定により、正常動作時のシンプルな設定を維持しながら、Storybookエラーを回避してCloudflare Pagesで動作させることができます。