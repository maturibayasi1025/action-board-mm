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
    if (process.env.CF_PAGES === "true" && isServer) {
      console.log(
        "[Webpack] Cloudflare Pages環境 - Prisma instrumentation無効化",
      );

      // Prismaのinstrumentationを外部依存として扱う
      config.externals = config.externals || [];
      config.externals.push("@prisma/instrumentation");
      config.externals.push("@opentelemetry/auto-instrumentations-node");
      config.externals.push("@opentelemetry/instrumentation");

      // Dynamic importエラーを回避
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "@prisma/instrumentation": false,
        "@opentelemetry/instrumentation": false,
      };
    }

    return config;
  },
};

// Sentry設定を完全に削除してCloudflare Pages互換性を確保
export default nextConfig;
