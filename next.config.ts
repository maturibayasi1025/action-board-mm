import path from "node:path";
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
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(process.cwd()),
      "@/components": path.resolve(process.cwd(), "components"),
      "@/lib": path.resolve(process.cwd(), "lib"),
      "@/app": path.resolve(process.cwd(), "app"),
    };

    if (isServer) {
      if (!config.externals) {
        config.externals = [];
      }
      if (Array.isArray(config.externals)) {
        config.externals.push("@prisma/instrumentation");
        config.externals.push("@opentelemetry/auto-instrumentations-node");
        config.externals.push("@opentelemetry/instrumentation");
      }
    }

    return config;
  },
};

export default nextConfig;
