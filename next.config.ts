import path from "node:path";
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
  // Cloudflare Pages環境でのPrisma instrumentation対策（シンプル版）
  webpack: (config, { isServer }) => {
    // Cloudflare Pages環境でのエイリアス解決を強制
    if (
      process.env.CF_PAGES === "true" ||
      process.env.NODE_ENV === "production"
    ) {
      console.log("[Webpack] Cloudflare Pages環境 - エイリアス解決設定を追加");

      // resolve.aliasを設定
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...config.resolve.alias,
        "@": path.resolve(process.cwd()),
        "@/components": path.resolve(process.cwd(), "components"),
        "@/lib": path.resolve(process.cwd(), "lib"),
        "@/app": path.resolve(process.cwd(), "app"),
      };
    }

    if (process.env.CF_PAGES === "true" && isServer) {
      console.log(
        "[Webpack] Cloudflare Pages環境 - Prisma instrumentation無効化",
      );

      // externalsを安全に設定
      if (!config.externals) {
        config.externals = [];
      }

      // 配列形式でexternalsを追加（resolve.fallbackは使用しない）
      if (Array.isArray(config.externals)) {
        config.externals.push("@prisma/instrumentation");
        config.externals.push("@opentelemetry/auto-instrumentations-node");
        config.externals.push("@opentelemetry/instrumentation");
      }
    }

    return config;
  },
};

// Sentry設定を完全に削除してCloudflare Pages互換性を確保
export default nextConfig;
