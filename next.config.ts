import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: process.env.STANDALONE_BUILD ? "standalone" : undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // キャッシュを無効化してビルドサイズを削減
  onDemandEntries: {
    // ページをメモリに保持する時間を短縮
    maxInactiveAge: 25 * 1000,
    // 同時に保持するページ数を制限
    pagesBufferLength: 2,
  },
  // ビルド時のキャッシュを無効化
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
  // Webpack設定でキャッシュを無効化
  webpack: (config, { dev, isServer }) => {
    if (!dev) {
      // 本番ビルド時にキャッシュを無効化
      config.cache = false;
      // 不要なファイルを除外
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            default: false,
            vendors: false,
          },
        },
      };
    }
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "team-mirai",
  project: "action-board",
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress logs unless UPLOAD_SOURCEMAPS is set
  silent: !process.env.UPLOAD_SOURCEMAPS,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: false,

  // Upload source maps to enable readable stack traces in errors
  // See the following for more information:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/build/#source-maps-options
  sourcemaps: {
    disable: !process.env.UPLOAD_SOURCEMAPS,
    ignore: ["**/node_modules/**", "**/.next/cache/**", "**/tests/**"],
    deleteSourcemapsAfterUpload: true,
  },

  release: {
    name: process.env.SENTRY_RELEASE,
    setCommits: undefined,
  },
});
