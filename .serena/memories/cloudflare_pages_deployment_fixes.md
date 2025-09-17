# Cloudflare Pages Deployment Fixes

## 最終解決策 (2025-09-18)

### 問題の根本原因判明: 動的アイコンファイル

**真の問題:**
- `app/apple-icon.tsx` と `app/icon.tsx` の動的アイコンファイルがCloudflare Pagesで問題を引き起こしていた
- Next.js 15でこれらが動的ルートハンドラーとして処理され、Cloudflare Pages環境で正しく動作しなかった

### 解決方法: 静的アイコンファイルへの置き換え

#### 1. 動的アイコンファイルを削除
```bash
rm app/apple-icon.tsx app/icon.tsx.disabled
```

#### 2. 静的アイコン画像を生成
ImageMagickを使用してティール色(#4fd1c7)背景に白文字「MM」の画像を生成：
```bash
# 32x32 アイコン
convert -size 32x32 xc:"#4fd1c7" -gravity center -pointsize 20 -font Arial-Bold -fill white -annotate +0+0 "MM" public/icon.png

# 180x180 Apple touch アイコン  
convert -size 180x180 xc:"#4fd1c7" -gravity center -pointsize 64 -font Arial-Bold -fill white -annotate +0+0 "MM" public/apple-icon.png
```

#### 3. appディレクトリに静的ファイルを配置
```bash
cp public/icon.png app/
cp public/apple-icon.png app/
```

### 設定ファイル（最終版）

#### next.config.ts
正常動作時のシンプルな設定 + TypeScript設定切り替えのみ：
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

#### package.json
```json
"build:cloudflare": "npm run clean && CF_PAGES=true NODE_ENV=production npx next build && npm run clean-cache"
```

#### wrangler.toml
正常動作時と同じ設定：
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
NEXT_PUBLIC_SUPABASE_URL = "https://plzqywjvkteyxsdqmred.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY = "..."
NEXT_PUBLIC_SITE_URL = "https://mm-actionboard.jp"
NEXT_PUBLIC_APP_ORIGIN = "https://mm-actionboard.jp"
CF_PAGES = "true"

[build.environment]
NODE_ENV = "production"
```

#### tsconfig.cloudflare.json
Storybookファイルを除外する専用設定：
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

### 結果の確認

✅ **ビルド成功:**
- Storybookエラーが解決
- アイコンが静的コンテンツとして認識
- Edge Function数が33→32に減少（アイコンルートが除外）

✅ **Cloudflare Pages Functions生成成功:**
- Prerendered Routes: `/apple-icon.png`, `/icon.png`, `/favicon.ico`
- Edge Function Routes: 32個（アイコン関連が除外）
- 全体的にクリーンなビルド出力

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

### 重要な学び

1. **動的アイコンファイルがCloudflare Pagesでの主要な問題だった**
   - Next.js 15のImageResponse APIによる動的アイコン生成がCloudflare Pages環境で問題を引き起こした
   - 静的ファイルに置き換えることで解決

2. **Storybookエラーは副次的な問題だった**
   - TypeScript設定の切り替えで解決
   - 最小限の変更で対応可能

3. **正常動作時の設定の重要性**
   - 複雑な最適化は不要
   - シンプルな設定が最も安定

この修正により、「画像だけが表示される」問題が解決され、正常なアプリケーションが表示されるはずです。