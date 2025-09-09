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

  // Cloudflare Pages環境でのPrisma instrumentation対策
  webpack: (config, { isServer }) => {
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

        // OpenTelemetry関連モジュールを完全に外部化
        config.externals.push("@opentelemetry/auto-instrumentations-node");
        config.externals.push("@opentelemetry/instrumentation");
        config.externals.push("@opentelemetry/api");
        config.externals.push("@opentelemetry/sdk-node");
        config.externals.push("@opentelemetry/resources");
        config.externals.push("@opentelemetry/semantic-conventions");

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
