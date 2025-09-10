import * as path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: process.env.STANDALONE_BUILD ? "standalone" : undefined,

  // Cloudflare Pages環境では専用のTSConfigを使用
  typescript:
    process.env.CF_PAGES === "true"
      ? {
          tsconfigPath: "./tsconfig.cloudflare.json",
        }
      : undefined,

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

    // Cloudflare Pages環境でStorybookファイルとモジュールを除外
    if (process.env.CF_PAGES === "true") {
      // TypeScriptチェックからStorybookファイルを除外
      config.module = config.module || {};
      config.module.rules = config.module.rules || [];

      // IgnorePluginでStorybookファイルを無視
      const webpack = require("webpack");
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /\.stories\.(ts|tsx|js|jsx)$/,
        }),
      );

      config.resolve.alias = {
        ...config.resolve.alias,
        "@storybook/react": false,
        "@storybook/nextjs": false,
        "@storybook/addon-essentials": false,
        "@storybook/blocks": false,
        "@storybook/test": false,
      };
    }

    // Cloudflare Pages環境でのminification最適化
    if (process.env.CF_PAGES === "true" && !dev) {
      config.optimization = config.optimization || {};
      // minificationを有効化してCloudflare Pagesとの互換性を確保
      config.optimization.minimize = true;
      // SWCミニファイヤーを使用
      config.optimization.minimizer = config.optimization.minimizer || [];
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

// Cloudflare Pages環境ではSentryラッパーを適用しない
if (process.env.CF_PAGES === "true" || process.env.DISABLE_SENTRY === "true") {
  // Cloudflare Pages環境では直接エクスポート
  module.exports = nextConfig;
} else {
  // 通常環境ではSentryラッパーを適用（オプショナル）
  try {
    const { withSentryConfig } = require("@sentry/nextjs");
    module.exports = withSentryConfig(
      nextConfig,
      {
        // Sentryビルドオプション
        silent: true,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      },
      {
        // 追加オプション
        widenClientFileUpload: true,
        transpileClientSDK: false,
        disableLogger: true,
        automaticVercelMonitors: false,
      },
    );
  } catch {
    // Sentryが利用できない場合は通常のconfigを使用
    module.exports = nextConfig;
  }
}

export default nextConfig;
