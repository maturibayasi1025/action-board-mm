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
  // Cloudflare Pages用TypeScript設定
  typescript:
    process.env.CF_PAGES === "true"
      ? {
          tsconfigPath: "./tsconfig.cloudflare.json",
        }
      : undefined,
  // Cloudflare Pages用webpack設定
  webpack: (config, { isServer }) => {
    // パス解決のためのエイリアス設定
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname),
    };

    // Cloudflare Pages用の最適化
    if (process.env.CF_PAGES === "true") {
      // 不要なモジュールの除外
      config.externals = config.externals || [];
      if (isServer) {
        config.externals.push({
          sharp: "commonjs sharp",
        });
      }
    }

    return config;
  },
};

// Sentry設定を完全に削除してCloudflare Pages互換性を確保
export default nextConfig;
