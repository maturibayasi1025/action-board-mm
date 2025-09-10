import * as path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: process.env.STANDALONE_BUILD ? "standalone" : undefined,

  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // instrumentation.tsは最新のNext.jsでは自動で有効化される
  },

  // Cloudflare Pages用のビルド最適化
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },

  // Cloudflare Pages用設定
  images: {
    unoptimized: true,
  },

  // コンパイラオプション（Cloudflare環境用に簡素化）
  compiler:
    process.env.CF_PAGES === "true"
      ? {}
      : {
          // Emotion、styled-componentsのサポートを無効化（未使用）
          emotion: false,
          styledComponents: false,
          // 本番環境でReact開発者ツールを無効化
          reactRemoveProperties:
            process.env.NODE_ENV === "production"
              ? { properties: ["^data-testid$"] }
              : false,
          // console.logを本番環境で削除
          removeConsole:
            process.env.NODE_ENV === "production"
              ? {
                  exclude: ["error", "warn"],
                }
              : false,
        },

  // Cloudflare Pages環境でのPrisma instrumentation対策
  webpack: (config, { isServer, dev }) => {
    // パスエイリアスの解決設定を追加
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname),
    };

    // Cloudflare Pages環境でminificationを無効化してエラーを回避
    if (process.env.CF_PAGES === "true" && !dev) {
      config.optimization = config.optimization || {};
      config.optimization.minimize = false;
    }

    // Cloudflare Pages環境でのみ適用（プロダクションビルドは除外）
    if (process.env.CF_PAGES === "true" && isServer) {
      console.log(
        "[Webpack] Cloudflare Pages環境 - Prisma/OpenTelemetry instrumentation無効化",
      );

      // externalsを安全に設定
      if (!config.externals) {
        config.externals = [];
      }

      // 配列形式でexternalsを追加
      if (Array.isArray(config.externals)) {
        // Prisma関連モジュールを完全に外部化
        config.externals.push("@prisma/instrumentation");
        config.externals.push("@prisma/client");
        config.externals.push("@prisma/engines");

        // その他のinstrumentationモジュール
        config.externals.push("dd-trace");
        config.externals.push("newrelic");
      }
    }

    return config;
  },
};

// Sentry設定を完全に削除してCloudflare Pages互換性を確保
export default nextConfig;
