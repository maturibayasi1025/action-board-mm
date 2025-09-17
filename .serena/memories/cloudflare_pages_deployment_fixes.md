# Cloudflare Pages Deployment Fixes

## 最終解決策 (2025-09-18)

### 問題の根本原因: 動的アイコンファイルとファイル配置

**真の問題:**
1. `app/apple-icon.tsx` と `app/icon.tsx` の動的アイコンファイルがCloudflare Pagesで問題を引き起こしていた
2. 静的ファイルを`app/`ディレクトリに配置すると、Next.jsがルートとして認識してしまう

### 解決方法: 静的アイコンファイルの正しい配置

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

#### 3. 🚨 重要: アイコンファイルはpublicディレクトリのみに配置
```bash
# ❌ 誤り - appディレクトリに配置するとルートとして認識される
# cp public/icon.png app/
# cp public/apple-icon.png app/

# ✅ 正解 - publicディレクトリのみに配置
ls public/icon.png public/apple-icon.png
```

### エラーと修正

**発生したエラー:**
```
⚡️ ERROR: Failed to produce a Cloudflare Pages build from the project.
⚡️ 
⚡️     The following routes were not configured to run with the Edge Runtime:
⚡️       - /apple-icon.png
⚡️       - /icon.png
⚡️ 
⚡️     Please make sure that all your non-static routes export the following edge runtime route segment config:
⚡️       export const runtime = 'edge';
```

**修正方法:**
```bash
# appディレクトリからアイコンファイルを削除
rm app/icon.png app/apple-icon.png
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

### 最終ビルド結果（成功）

✅ **Next.js Build:**
- `/apple-icon.png`, `/icon.png` ルートが削除された
- Edge Function Routes: 32個（アイコン関連が除外）

✅ **Cloudflare Pages Build:**
- エラー解決: Edge Runtime関連エラーなし
- Prerendered Routes: `/favicon.ico` のみ（アイコンは静的アセット）
- Other Static Assets: 226個（アイコンファイルを含む）

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

1. **静的ファイルの配置場所が重要**
   - `app/`ディレクトリ内のファイルはNext.jsによってルートとして認識される
   - 静的アセット（アイコン、画像等）は`public/`ディレクトリに配置する

2. **動的アイコンファイルの問題**
   - Next.js 15のImageResponse APIによる動的アイコン生成がCloudflare Pages環境で問題を引き起こした
   - 静的ファイルに置き換えることで解決

3. **正常動作時の設定の重要性**
   - 複雑な最適化は不要
   - シンプルな設定が最も安定

この修正により、Cloudflare Pagesでのビルドエラーが解決され、正常なアプリケーションが表示されるはずです。