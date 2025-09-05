# Sentry再導入ガイド

## 📄 概要

Server Componentsレンダリングエラー（Digest: 1126964366）によりSentryを一時的に無効化しました。
このドキュメントでは、段階的にSentryを再導入する手順を説明します。

## 🔧 現在の状態

### 実装済みの代替ソリューション

1. **カスタムロガー** (`/lib/logger.ts`)
   - エラーログの収集と記録
   - 開発/本番環境での切り替え
   - React Error Boundary統合

2. **グローバルエラーハンドラー** (`/app/global-error.tsx`)
   - カスタムロガー統合
   - 詳細なデバッグ情報表示

3. **APIエンドポイント** (`/app/api/logs/route.ts`)
   - エラーログの収集
   - Slack通知機能

## 🚀 Sentry再導入手順

### ステップ1: 最新版のSDKインストール

```bash
# Sentry SDKの最新版をインストール
npm install @sentry/nextjs@latest

# または
yarn add @sentry/nextjs@latest
```

### ステップ2: 環境変数の設定

`.env.local` または `.env.production` に以下を追加:

```env
# Sentry設定
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production

# Sentryを無効化する場合（オプション）
DISABLE_SENTRY=false
NEXT_PUBLIC_DISABLE_SENTRY=false

# デバッグ用（開発環境のみ）
SENTRY_DEBUG=true
```

### ステップ3: next.config.tsの更新

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.STANDALONE_BUILD ? "standalone" : undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // instrumentation hookを有効化
    instrumentationHook: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

### ステップ4: テスト環境での検証

```bash
# デバッグモードでビルド
SENTRY_DEBUG=true npm run build

# テスト環境で起動
npm run dev
```

### ステップ5: 段階的な有効化

#### フェーズ1: サーバーサイドのみ
```bash
# サーバーサイドのみ有効化
NEXT_PUBLIC_DISABLE_SENTRY=true npm run build
```

#### フェーズ2: クライアントサイドも有効化
```bash
# 完全に有効化
npm run build
```

## 🔍 トラブルシューティング

### 問題: Server Componentsでエラーが発生

**解決策:**
1. Edge RuntimeではSentryを無効化
2. `autoSessionTracking: false` を設定
3. Replay等のクライアント機能を無効化

### 問題: ビルドが失敗する

**解決策:**
```bash
# Sentryを無効化してビルド
DISABLE_SENTRY=true npm run build
```

### 問題: Cloudflare Pagesで動作しない

**解決策:**
```bash
# Cloudflare Pages用ビルド
npm run build:pages:no-sentry
```

## 🎯 代替ソリューション

Sentryが再導入できない場合の代替案:

### 1. **Axiom**
- 軽量なログ管理サービス
- Next.jsとの良好な統合
- コスト効率的

### 2. **Datadog**
- エンタープライズ向け
- APMとログ管理の統合
- 高度な分析機能

### 3. **Vercel Analytics**
- Vercelプラットフォームとの完全統合
- Web Vitalsモニタリング
- ゼロ設定

### 4. **カスタムソリューションの拡張**

現在のカスタムロガーを拡張:

```typescript
// lib/logger.ts に追加
class ErrorLogger {
  // CloudWatchへの送信
  async sendToCloudWatch(logEntry: ErrorLogEntry) {
    // AWS SDKを使用してCloudWatch Logsに送信
  }
  
  // Supabaseのログテーブルに保存
  async saveToSupabase(logEntry: ErrorLogEntry) {
    // Supabaseクライアントを使用
  }
}
```

## 📈 モニタリングダッシュボード

カスタムログを可視化するためのダッシュボードを追加:

```typescript
// app/admin/logs/page.tsx
import { createClient } from "@/lib/supabase/server";

export default async function LogsPage() {
  // ログデータを取得して表示
  // SupabaseテーブルまたはCloudWatchから取得
}
```

## 📝 チェックリスト

- [ ] カスタムロガーが正常に動作している
- [ ] エラーログAPIが機能している
- [ ] Sentry SDKを最新版に更新
- [ ] テスト環境で検証完了
- [ ] ステージング環境で検証完了
- [ ] 本番環境へのデプロイ
- [ ] モニタリング確認

## 📞 サポート

問題が発生した場合:
1. エラーログを確認
2. `SENTRY_DEBUG=true` で詳細情報を取得
3. GitHub Issuesで報告

---

*最終更新: 2025年1月*