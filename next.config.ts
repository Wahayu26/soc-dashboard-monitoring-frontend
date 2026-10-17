import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/overview",
        destination: "/",
      },
      {
        source: "/soc-dashboard-finale",
        destination: "/",
      },
      {
        source: "/soc-dashboard-finale/",
        destination: "/",
      },
    ];
  },
  async redirects() {
    return [];
  },
};

export default nextConfig;
